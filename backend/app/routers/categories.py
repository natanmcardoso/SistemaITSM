"""CRUD de categorias (Fase 10, sub-fase 10.1) — GET/POST/PATCH /categories,
restrito a technician/manager (mesmo padrão de POST/PATCH /kb-articles na
Fase 8.4 — require_role). Tela de Configurações do técnico/gestor.

`Category.name` não é único no schema, mas a triagem por IA casa a sugestão
por nome (app/services/triage.py) — nomes duplicados já causaram bugs reais
neste projeto (correções em test_phase1 e test_phase3, ver CLAUDE.md). Por
isso o POST/PATCH aqui barram duplicata (case-insensitive) na aplicação,
mesmo sem constraint no banco.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate
from app.security import require_role

router = APIRouter(
    prefix="/categories",
    tags=["categories"],
    dependencies=[Depends(require_role("technician", "manager"))],
)


def _find_duplicate_name(db: Session, name: str, exclude_id: Optional[uuid.UUID] = None) -> Optional[Category]:
    q = db.query(Category).filter(func.lower(Category.name) == name.strip().lower())
    if exclude_id is not None:
        q = q.filter(Category.id != exclude_id)
    return q.first()


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    if _find_duplicate_name(db, payload.name) is not None:
        raise HTTPException(status_code=400, detail="Já existe uma categoria com esse nome")
    category = Category(name=payload.name, default_sla_hours=payload.default_sla_hours)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(category_id: uuid.UUID, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and _find_duplicate_name(db, updates["name"], exclude_id=category_id) is not None:
        raise HTTPException(status_code=400, detail="Já existe uma categoria com esse nome")

    for field, value in updates.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return category
