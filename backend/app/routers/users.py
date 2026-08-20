"""Administração (Fase 11, sub-fase 11.2) — GET/POST /users, PATCH /users/{id},
restritos a role=admin (require_role, mesmo padrão do resto da Fase 10/11).

Cada criação/edição grava uma entrada em `audit_log` (app/services/audit.py)
na mesma transação — trilha de auditoria das ações administrativas.

Sem troca de senha nem desativação de conta nesta sub-fase (fora do pedido
original: `GET/POST /users`, `PATCH /users/{id}`).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut, UserUpdate
from app.security import hash_password, require_role
from app.services.audit import log_action

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_role("admin"))])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.name).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    user = User(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Já existe um usuário com esse e-mail") from exc

    log_action(db, admin, "create_user", "user", entity_id=user.id, details=f"role={user.role}")
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)

    log_action(db, admin, "update_user", "user", entity_id=user.id, details=str(updates))
    db.commit()
    db.refresh(user)
    return user
