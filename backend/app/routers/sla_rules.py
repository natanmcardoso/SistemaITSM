"""Regras de SLA (Fase 10, sub-fase 10.2) — GET/PATCH /sla-rules, restrito a
technician/manager (mesmo padrão de /categories, Fase 10.1).

Sem POST: as 4 prioridades já são fixas no enum `ticket_priority`
(app/models.py) e `SLARule.priority` é única — uma regra por prioridade,
semeada por seed_dev_data.py (Fase 4, sub-fase SLA). Aqui só edita
response_time_hours/resolution_time_hours de uma regra já existente.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SLARule
from app.schemas import SLARuleOut, SLARuleUpdate
from app.security import require_role

router = APIRouter(
    prefix="/sla-rules",
    tags=["sla-rules"],
    dependencies=[Depends(require_role("technician", "manager"))],
)


@router.get("", response_model=list[SLARuleOut])
def list_sla_rules(db: Session = Depends(get_db)):
    return db.query(SLARule).order_by(SLARule.resolution_time_hours).all()


@router.patch("/{rule_id}", response_model=SLARuleOut)
def update_sla_rule(rule_id: uuid.UUID, payload: SLARuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(SLARule).filter(SLARule.id == rule_id).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="Regra de SLA não encontrada")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(rule, field, value)

    db.commit()
    db.refresh(rule)
    return rule
