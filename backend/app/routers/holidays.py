"""Feriados do calendário (Fase 13) — GET/POST/DELETE /holidays, restrito a
technician/manager (mesmo padrão de /categories, Fase 10.1).

Sem PATCH: um feriado é só uma data + nome — errou a data, apaga e recria
(mais simples que editar). Primeiro endpoint DELETE do projeto: faz sentido
aqui porque "remover um feriado cadastrado errado" é o caso de uso real,
diferente do resto do CRUD (categorias/serviços/KB), onde editar é mais
comum que remover.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Holiday
from app.schemas import HolidayCreate, HolidayOut
from app.security import require_role

router = APIRouter(
    prefix="/holidays",
    tags=["holidays"],
    dependencies=[Depends(require_role("technician", "manager"))],
)


@router.get("", response_model=list[HolidayOut])
def list_holidays(db: Session = Depends(get_db)):
    return db.query(Holiday).order_by(Holiday.date).all()


@router.post("", response_model=HolidayOut, status_code=201)
def create_holiday(payload: HolidayCreate, db: Session = Depends(get_db)):
    holiday = Holiday(date=payload.date, name=payload.name)
    db.add(holiday)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Já existe um feriado cadastrado nessa data") from exc
    db.refresh(holiday)
    return holiday


@router.delete("/{holiday_id}", status_code=204)
def delete_holiday(holiday_id: uuid.UUID, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if holiday is None:
        raise HTTPException(status_code=404, detail="Feriado não encontrado")
    db.delete(holiday)
    db.commit()
