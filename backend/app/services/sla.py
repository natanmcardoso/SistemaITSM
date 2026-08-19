"""Cálculo de SLA (Fase 4, sub-fase SLA).

`sla_due_at` = criação do chamado + `resolution_time_hours` da `sla_rules`
para a prioridade final do chamado (design-itsm-mvp.md §3/§5). Se não houver
regra cadastrada pra aquela prioridade (ex.: `priority` nulo, ou banco sem
seed de `sla_rules`), fica nulo em vez de quebrar — mesmo padrão já usado na
triagem por IA quando a categoria sugerida não bate com nenhuma cadastrada
(app/services/triage.py).
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import SLARule


def compute_sla_due_at(priority: str | None, db: Session, *, from_time: datetime | None = None) -> datetime | None:
    if priority is None:
        return None
    rule = db.query(SLARule).filter(SLARule.priority == priority).first()
    if rule is None:
        return None
    base = from_time or datetime.now(timezone.utc)
    return base + timedelta(hours=rule.resolution_time_hours)
