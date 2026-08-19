"""Endpoints core de tickets — CRUD (Fase 2) + triagem por IA (Fase 3).

Guard de autenticação plugado na Fase 4 (tela 3/3, junto com o dashboard do
gestor) — qualquer usuário logado (end_user/technician/manager) pode chamar
estes endpoints, sem restrição por role: usuário final cria os próprios
chamados, técnico gerencia a fila.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Interaction, Ticket, User
from app.schemas import InteractionCreate, InteractionOut, TicketCreate, TicketDetailOut, TicketOut, TicketUpdate
from app.security import get_current_user
from app.services.sla import compute_sla_due_at
from app.services.triage import triage_ticket

router = APIRouter(prefix="/tickets", tags=["tickets"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=TicketOut, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    # Sugestão da IA é sempre calculada e preservada em ai_suggested_* (métricas
    # de acerto — design-itsm-mvp.md §5). Se o chamador não informou priority/
    # category_id explicitamente, a sugestão vira o valor inicial do chamado.
    triage = triage_ticket(payload.title, payload.description, db)
    final_priority = payload.priority if payload.priority is not None else triage.priority

    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        requester_id=payload.requester_id,
        category_id=payload.category_id if payload.category_id is not None else triage.category_id,
        priority=final_priority,
        assignee_id=payload.assignee_id,
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
            status_code=400, detail="requester_id, category_id ou assignee_id inválido(s)"
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
    assignee_id: Optional[uuid.UUID] = Query(None),
    requester_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket)
    if status is not None:
        query = query.filter(Ticket.status == status)
    if priority is not None:
        query = query.filter(Ticket.priority == priority)
    if assignee_id is not None:
        query = query.filter(Ticket.assignee_id == assignee_id)
    if requester_id is not None:
        query = query.filter(Ticket.requester_id == requester_id)
    return query.order_by(Ticket.created_at.desc()).all()


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
