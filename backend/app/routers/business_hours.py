"""Calendário de horário comercial (Fase 13) — GET/PATCH /business-hours,
restrito a technician/manager (mesmo padrão de /sla-rules, Fase 10.2).

Sem POST/DELETE: as 7 linhas (uma por dia da semana) já são fixas —
semeadas por seed_dev_data.py — e `BusinessHours.weekday` é único. Aqui só
edita is_open/start_time/end_time de um dia já existente.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BusinessHours
from app.schemas import BusinessHoursOut, BusinessHoursUpdate
from app.security import require_role

router = APIRouter(
    prefix="/business-hours",
    tags=["business-hours"],
    dependencies=[Depends(require_role("technician", "manager"))],
)


@router.get("", response_model=list[BusinessHoursOut])
def list_business_hours(db: Session = Depends(get_db)):
    return db.query(BusinessHours).order_by(BusinessHours.weekday).all()


@router.patch("/{business_hours_id}", response_model=BusinessHoursOut)
def update_business_hours(business_hours_id: uuid.UUID, payload: BusinessHoursUpdate, db: Session = Depends(get_db)):
    bh = db.query(BusinessHours).filter(BusinessHours.id == business_hours_id).first()
    if bh is None:
        raise HTTPException(status_code=404, detail="Dia do calendário não encontrado")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(bh, field, value)

    if bh.is_open:
        if bh.start_time is None or bh.end_time is None:
            raise HTTPException(status_code=400, detail="Dia aberto precisa de start_time e end_time")
        if bh.start_time >= bh.end_time:
            raise HTTPException(status_code=400, detail="start_time deve ser antes de end_time")
    else:
        # Dia fechado não guarda horário (mesma leitura do add_business_hours,
        # que ignora start_time/end_time quando is_open=False).
        bh.start_time = None
        bh.end_time = None

    db.commit()
    db.refresh(bh)
    return bh
