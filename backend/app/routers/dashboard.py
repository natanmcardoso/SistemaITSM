"""Dashboard do gestor (Fase 4, tela 3/3 + sub-fases SLA e resolve-by-user).

Volume de chamados, distribuição por status, top categorias, acerto da
sugestão da IA (sugerida vs. valor final de priority/category_id —
design-itsm-mvp.md §5), SLA estourado (app/services/sla.py) e % resolvido
por IA sem técnico (`resolved_by_ai`, setado só via
POST /tickets/{id}/resolve-by-user) — as 4 métricas centrais do design doc
§2.3, todas com dado real agora.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TICKET_STATUSES, Category, Ticket
from app.schemas import AIAccuracyMetric, AIResolutionMetric, CategoryCount, DashboardSummary, SLAMetric
from app.security import require_role

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_OPEN_STATUSES = [s for s in TICKET_STATUSES if s not in ("resolved", "closed")]


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

    return DashboardSummary(
        total_tickets=total_tickets,
        by_status=by_status,
        top_categories=top_categories,
        ai_accuracy_priority=_ai_accuracy(db, Ticket.ai_suggested_priority, Ticket.priority),
        ai_accuracy_category=_ai_accuracy(db, Ticket.ai_suggested_category_id, Ticket.category_id),
        sla=SLAMetric(tracked_total=tracked_total, breached=breached),
        ai_resolution=AIResolutionMetric(total_tickets=total_tickets, resolved_by_ai=resolved_by_ai),
    )
