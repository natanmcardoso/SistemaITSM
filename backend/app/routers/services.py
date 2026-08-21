"""Catálogo de Serviços (Fase 12) — GET/POST/PATCH /services.

Diferente de categories.py (Fase 10), o GET aqui é aberto a qualquer usuário
autenticado (sem require_role) — o catálogo é justamente a tela que o
usuário final consome pra escolher um serviço ao abrir chamado. POST/PATCH
seguem restritos a technician/manager, mesmo padrão do CRUD de categorias
(cadastro é tarefa de Configurações).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Service
from app.schemas import ServiceCreate, ServiceOut, ServiceUpdate
from app.security import get_current_user, require_role

router = APIRouter(prefix="/services", tags=["services"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[ServiceOut])
def list_services(db: Session = Depends(get_db)):
    return db.query(Service).order_by(Service.name).all()


@router.post(
    "",
    response_model=ServiceOut,
    status_code=201,
    dependencies=[Depends(require_role("technician", "manager"))],
)
def create_service(payload: ServiceCreate, db: Session = Depends(get_db)):
    service = Service(name=payload.name, category_id=payload.category_id, description=payload.description)
    db.add(service)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="category_id inválido") from exc
    db.refresh(service)
    return service


@router.patch(
    "/{service_id}",
    response_model=ServiceOut,
    dependencies=[Depends(require_role("technician", "manager"))],
)
def update_service(service_id: uuid.UUID, payload: ServiceUpdate, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if service is None:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(service, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="category_id inválido") from exc
    db.refresh(service)
    return service
