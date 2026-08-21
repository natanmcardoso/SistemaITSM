"""Endpoints core de tickets — CRUD (Fase 2) + triagem por IA (Fase 3).

Guard de autenticação plugado na Fase 4 (tela 3/3, junto com o dashboard do
gestor) — qualquer usuário logado (end_user/technician/manager) pode chamar
estes endpoints, sem restrição por role: usuário final cria os próprios
chamados, técnico gerencia a fila.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased, selectinload

from app.database import get_db
from app.models import TICKET_STATUSES, Interaction, Service, Ticket, User
from app.schemas import InteractionCreate, InteractionOut, TicketCreate, TicketDetailOut, TicketOut, TicketUpdate
from app.security import get_current_user
from app.services.sla import compute_sla_due_at
from app.services.triage import triage_ticket

router = APIRouter(prefix="/tickets", tags=["tickets"], dependencies=[Depends(get_current_user)])

# Mesma definição de "estourado" usada em GET /dashboard/summary.sla
# (app/routers/dashboard.py) — chamado com prazo calculado, no passado, e
# ainda não resolvido/fechado. Reaproveitada aqui pra o link "SLA estourado"
# do dashboard (Fase 5) cair numa fila já filtrada de verdade.
_OPEN_STATUSES = [s for s in TICKET_STATUSES if s not in ("resolved", "closed")]


@router.post("", response_model=TicketOut, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    # Sugestão da IA é sempre calculada e preservada em ai_suggested_* (métricas
    # de acerto — design-itsm-mvp.md §5). Se o chamador não informou priority/
    # category_id explicitamente, a sugestão vira o valor inicial do chamado.
    triage = triage_ticket(payload.title, payload.description, db)
    final_priority = payload.priority if payload.priority is not None else triage.priority

    # Fase 12 (Catálogo de Serviços) — abrir chamado a partir de um serviço do
    # catálogo pré-seleciona a categoria: se category_id não vier explícito,
    # a categoria do serviço tem prioridade sobre a sugestão da IA (a escolha
    # do usuário no catálogo é mais específica que a triagem por texto).
    # ai_suggested_category_id continua sempre a sugestão pura da IA, sem
    # influência do serviço — não afeta a métrica de acerto.
    final_category_id = payload.category_id
    if final_category_id is None and payload.service_id is not None:
        service = db.query(Service).filter(Service.id == payload.service_id).first()
        if service is None:
            raise HTTPException(status_code=400, detail="service_id inválido")
        final_category_id = service.category_id
    if final_category_id is None:
        final_category_id = triage.category_id

    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        requester_id=payload.requester_id,
        category_id=final_category_id,
        priority=final_priority,
        assignee_id=payload.assignee_id,
        service_id=payload.service_id,
        ai_suggested_priority=triage.priority,
        ai_suggested_category_id=triage.category_id,
        status="open",
        sla_due_at=compute_sla_due_at(final_priority, db),
    )
    db.add(ticket)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="requester_id, category_id, assignee_id ou service_id inválido(s)"
        ) from exc
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/resolve-by-user", response_model=TicketOut)
def resolve_by_user(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Usuário fecha o próprio chamado a partir da sugestão da IA, sem
    intervenção de técnico (design-itsm-mvp.md §2.1/§5) — alimenta a métrica
    central do dashboard (% resolvido por IA, §2.3).
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    if ticket.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Só o solicitante pode resolver o próprio chamado")
    if ticket.status != "open":
        raise HTTPException(
            status_code=400,
            detail="Chamado só pode ser resolvido pelo usuário enquanto está aberto e sem atendimento",
        )

    ticket.status = "resolved"
    ticket.resolved_by_ai = True
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("", response_model=list[TicketOut])
def list_tickets(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category_id: Optional[uuid.UUID] = Query(None),
    assignee_id: Optional[uuid.UUID] = Query(None),
    requester_id: Optional[uuid.UUID] = Query(None),
    query: Optional[str] = Query(None),
    sla: Optional[str] = Query(None, description="Único valor aceito: 'breached'"),
    db: Session = Depends(get_db),
):
    # Fase 5 (Navegação e Descoberta): category_id, query (busca por texto em
    # título/descrição) e sla=breached somam-se aos filtros já existentes —
    # query segue o mesmo padrão de busca substring case-insensitive usado em
    # kb-articles?query=; sla=breached alimenta o link "SLA estourado" do
    # dashboard.
    # Fase 8.3: query também casa pelo nome do solicitante ou do técnico
    # atribuído (join com users, aliased duas vezes — cada chamado tem no
    # máximo um solicitante e um atribuído, então o outerjoin não duplica
    # linha nenhuma).
    q = db.query(Ticket)
    if status is not None:
        q = q.filter(Ticket.status == status)
    if priority is not None:
        q = q.filter(Ticket.priority == priority)
    if category_id is not None:
        q = q.filter(Ticket.category_id == category_id)
    if assignee_id is not None:
        q = q.filter(Ticket.assignee_id == assignee_id)
    if requester_id is not None:
        q = q.filter(Ticket.requester_id == requester_id)
    if query:
        term = f"%{query}%"
        Requester = aliased(User)
        Assignee = aliased(User)
        q = (
            q.outerjoin(Requester, Ticket.requester_id == Requester.id)
            .outerjoin(Assignee, Ticket.assignee_id == Assignee.id)
            .filter(
                or_(
                    Ticket.title.ilike(term),
                    Ticket.description.ilike(term),
                    Requester.name.ilike(term),
                    Assignee.name.ilike(term),
                )
            )
        )
    if sla == "breached":
        q = q.filter(
            Ticket.sla_due_at.isnot(None),
            Ticket.sla_due_at < datetime.now(timezone.utc),
            Ticket.status.in_(_OPEN_STATUSES),
        )
    return q.order_by(Ticket.created_at.desc()).all()


@router.get("/{ticket_id}", response_model=TicketDetailOut)
def get_ticket(ticket_id: uuid.UUID, db: Session = Depends(get_db)):
    ticket = (
        db.query(Ticket)
        .options(selectinload(Ticket.interactions))
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    return ticket


@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket(ticket_id: uuid.UUID, payload: TicketUpdate, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(ticket, field, value)

    # Reclassificação de prioridade recalcula o prazo, mas sem resetar o
    # relógio do SLA: continua contando a partir da criação do chamado, não
    # do instante do PATCH (senão dava pra "ganhar tempo" só reclassificando).
    if "priority" in updates:
        ticket.sla_due_at = compute_sla_due_at(ticket.priority, db, from_time=ticket.created_at)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="category_id ou assignee_id inválido(s)"
        ) from exc
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/interactions", response_model=InteractionOut, status_code=201)
def create_interaction(
    ticket_id: uuid.UUID,
    payload: InteractionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra uma entrada de histórico no chamado (tela de detalhe, Fase 4).

    Sem restrição de role — mesmo padrão dos outros endpoints de tickets.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")

    interaction = Interaction(ticket_id=ticket.id, author_id=current_user.id, content=payload.content)
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    return interaction
