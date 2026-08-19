"""Dashboard do gestor (Fase 4, tela 3/3).

Reaproveita só o que já é dado real no banco hoje: volume de chamados,
distribuição por status, top categorias e o acerto da sugestão da IA
(sugerida vs. valor final de priority/category_id — design-itsm-mvp.md §5).

SLA estourado e % resolvido por IA (as outras duas métricas centrais do
design doc, §2.3) ficam de fora por decisão explícita: `sla_due_at` nunca é
calculado (a tabela `sla_rules` não é usada em nenhum código) e
`resolved_by_ai` nunca é setado (não existe endpoint resolve-by-user) — ver
CLAUDE.md.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TICKET_STATUSES, Category, Ticket
from app.schemas import AIAccuracyMetric, CategoryCount, DashboardSummary
from app.security import require_role

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


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

    return DashboardSummary(
        total_tickets=total_tickets,
        by_status=by_status,
        top_categories=top_categories,
        ai_accuracy_priority=_ai_accuracy(db, Ticket.ai_suggested_priority, Ticket.priority),
        ai_accuracy_category=_ai_accuracy(db, Ticket.ai_suggested_category_id, Ticket.category_id),
    )
