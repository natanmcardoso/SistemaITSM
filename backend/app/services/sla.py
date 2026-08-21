"""Cálculo de SLA (Fase 4, sub-fase SLA; horário comercial desde a Fase 13).

`sla_due_at` = criação do chamado + `resolution_time_hours` (em horário
comercial, desde a Fase 13 — antes era corrido/24-7) da `sla_rules` para a
prioridade final do chamado (design-itsm-mvp.md §3/§5). Se não houver regra
cadastrada pra aquela prioridade (ex.: `priority` nulo, ou banco sem seed de
`sla_rules`), fica nulo em vez de quebrar — mesmo padrão já usado na
triagem por IA quando a categoria sugerida não bate com nenhuma cadastrada
(app/services/triage.py). Pelo mesmo motivo, se o calendário de horário
comercial não estiver semeado (business_hours vazia ou todo mundo fechado),
`add_business_hours` devolve None e o chamado fica sem SLA em vez de quebrar.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import BusinessHours, Holiday, SLARule
from app.services.business_hours import DayWindow, add_business_hours


def _load_windows(db: Session) -> dict[int, DayWindow]:
    rows = db.query(BusinessHours).all()
    return {row.weekday: DayWindow(row.is_open, row.start_time, row.end_time) for row in rows}


def _load_holidays(db: Session) -> set:
    return {row.date for row in db.query(Holiday).all()}


def compute_sla_due_at(priority: str | None, db: Session, *, from_time: datetime | None = None) -> datetime | None:
    if priority is None:
        return None
    rule = db.query(SLARule).filter(SLARule.priority == priority).first()
    if rule is None:
        return None
    base = from_time or datetime.now(timezone.utc)
    windows = _load_windows(db)
    holidays = _load_holidays(db)
    return add_business_hours(base, rule.resolution_time_hours, windows, holidays)
