"""Dashboard do gestor (Fase 4, tela 3/3 + sub-fases SLA e resolve-by-user)
e dashboard pessoal do técnico (Fase 14 — Dashboard expandido).

Volume de chamados, distribuição por status, top categorias, acerto da
sugestão da IA (sugerida vs. valor final de priority/category_id —
design-itsm-mvp.md §5), SLA estourado (app/services/sla.py) e % resolvido
por IA sem técnico (`resolved_by_ai`, setado só via
POST /tickets/{id}/resolve-by-user) — as 4 métricas centrais do design doc
§2.3, todas com dado real agora.

Fase 14 — duas decisões confirmadas com o usuário antes de codar: o widget
de produtividade por técnico entra no dashboard do gestor (não um dashboard
novo pra isso), e "meus chamados/pendências/aguardando resposta" (pessoais,
por natureza) viram um dashboard novo, próprio do técnico — hoje só o
gestor tinha dashboard.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TICKET_STATUSES, Asset, Category, Problem, Ticket, User
from app.schemas import (
    AIAccuracyMetric,
    AIResolutionMetric,
    CategoryCount,
    DashboardSummary,
    SLAMetric,
    TechnicianDashboardSummary,
)
from app.security import get_current_user, require_role

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_OPEN_STATUSES = [s for s in TICKET_STATUSES if s not in ("resolved", "closed")]
_DONE_STATUSES = ("resolved", "closed")


def _ai_accuracy(db: Session, suggested_col, final_col) -> AIAccuracyMetric:
    suggested_total = db.query(Ticket).filter(suggested_col.isnot(None)).count()
    matched = db.query(Ticket).filter(suggested_col.isnot(None), final_col == suggested_col).count()
    return AIAccuracyMetric(
        suggested_total=suggested_total,
        matched=matched,
        changed=suggested_total - matched,
    )


@router.get(
    "/summary",
    response_model=DashboardSummary,
    dependencies=[Depends(require_role("manager"))],
)
def get_summary(db: Session = Depends(get_db)):
    total_tickets = db.query(Ticket).count()

    by_status = {status: 0 for status in TICKET_STATUSES}
    for status, count in db.query(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status).all():
        by_status[status] = count

    category_rows = (
        db.query(Category.name, func.count(Ticket.id))
        .join(Ticket, Ticket.category_id == Category.id)
        .group_by(Category.name)
        .order_by(func.count(Ticket.id).desc())
        .all()
    )
    top_categories = [CategoryCount(name=name, count=count) for name, count in category_rows]

    tracked_total = db.query(Ticket).filter(Ticket.sla_due_at.isnot(None)).count()
    breached = (
        db.query(Ticket)
        .filter(
            Ticket.sla_due_at.isnot(None),
            Ticket.sla_due_at < datetime.now(timezone.utc),
            Ticket.status.in_(_OPEN_STATUSES),
        )
        .count()
    )

    resolved_by_ai = db.query(Ticket).filter(Ticket.resolved_by_ai.is_(True)).count()

    # CMDB + Problem Management (Fase 6) — sem tela de CRUD dedicada; o
    # dashboard é o único lugar que mostra o vínculo (design: "N chamados
    # vinculados a este ativo/problema").
    asset_rows = (
        db.query(Asset.name, func.count(Ticket.id))
        .join(Ticket, Ticket.asset_id == Asset.id)
        .group_by(Asset.name)
        .order_by(func.count(Ticket.id).desc())
        .all()
    )
    top_assets = [CategoryCount(name=name, count=count) for name, count in asset_rows]

    problem_rows = (
        db.query(Problem.title, func.count(Ticket.id))
        .join(Ticket, Ticket.problem_id == Problem.id)
        .group_by(Problem.title)
        .order_by(func.count(Ticket.id).desc())
        .all()
    )
    top_problems = [CategoryCount(name=title, count=count) for title, count in problem_rows]

    # Fase 14 — produtividade por técnico: chamados resolvidos/fechados,
    # agrupados pelo técnico atribuído. Só entram técnicos com pelo menos 1
    # chamado concluído (mesmo padrão de top_categories/top_assets/top_problems
    # — junção interna, sem linha "zerada" pra quem não tem nada).
    productivity_rows = (
        db.query(User.name, func.count(Ticket.id))
        .join(Ticket, Ticket.assignee_id == User.id)
        .filter(Ticket.status.in_(_DONE_STATUSES))
        .group_by(User.name)
        .order_by(func.count(Ticket.id).desc())
        .all()
    )
    productivity_by_technician = [CategoryCount(name=name, count=count) for name, count in productivity_rows]

    return DashboardSummary(
        total_tickets=total_tickets,
        by_status=by_status,
        top_categories=top_categories,
        ai_accuracy_priority=_ai_accuracy(db, Ticket.ai_suggested_priority, Ticket.priority),
        ai_accuracy_category=_ai_accuracy(db, Ticket.ai_suggested_category_id, Ticket.category_id),
        sla=SLAMetric(tracked_total=tracked_total, breached=breached),
        ai_resolution=AIResolutionMetric(total_tickets=total_tickets, resolved_by_ai=resolved_by_ai),
        top_assets=top_assets,
        top_problems=top_problems,
        productivity_by_technician=productivity_by_technician,
    )


@router.get(
    "/my-summary",
    response_model=TechnicianDashboardSummary,
    dependencies=[Depends(require_role("technician"))],
)
def get_my_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mine_active = db.query(Ticket).filter(
        Ticket.assignee_id == current_user.id, Ticket.status.in_(_OPEN_STATUSES)
    )
    meus_chamados = mine_active.count()
    pendencias = mine_active.filter(Ticket.status == "open").count()
    criticos = mine_active.filter(Ticket.priority == "critical").count()
    aguardando_resposta = mine_active.filter(Ticket.status == "in_progress").count()

    return TechnicianDashboardSummary(
        meus_chamados=meus_chamados,
        pendencias=pendencias,
        criticos=criticos,
        aguardando_resposta=aguardando_resposta,
    )
