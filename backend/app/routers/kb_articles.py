"""Base de conhecimento (Fase 4, sub-fase resolve-by-user; busca por texto
adicionada na fase de fechamento dos gaps de §2.1/§2.2).

Simplificação de escopo registrada no CLAUDE.md: o design doc (§5) imagina a
IA de triagem já devolvendo o artigo sugerido junto com categoria/prioridade.
Aqui a sugestão é feita casando por `category_id` (sem envolver a IA) — não
mexe no serviço de triagem já fechado e testado (app/services/triage.py).

`GET /kb-articles?query=` cobre a busca livre do design doc (§4) — substring
case-insensitive em título OU conteúdo, combinável com `category_id`.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import KBArticle
from app.schemas import KBArticleCreate, KBArticleOut, KBArticleUpdate
from app.security import get_current_user, require_role

router = APIRouter(prefix="/kb-articles", tags=["kb-articles"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[KBArticleOut])
def list_kb_articles(
    category_id: Optional[uuid.UUID] = Query(None),
    query: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(KBArticle)
    if category_id is not None:
        q = q.filter(KBArticle.category_id == category_id)
    if query:
        term = f"%{query}%"
        q = q.filter(or_(KBArticle.title.ilike(term), KBArticle.content.ilike(term)))
    return q.order_by(KBArticle.times_suggested.desc()).all()


@router.get("/{article_id}", response_model=KBArticleOut)
def get_kb_article(article_id: uuid.UUID, db: Session = Depends(get_db)):
    article = db.query(KBArticle).filter(KBArticle.id == article_id).first()
    if article is None:
        raise HTTPException(status_code=404, detail="Artigo não encontrado")
    return article


@router.post(
    "",
    response_model=KBArticleOut,
    status_code=201,
    dependencies=[Depends(require_role("technician"))],
)
def create_kb_article(payload: KBArticleCreate, db: Session = Depends(get_db)):
    """Fase 8.4 — criação de artigo, restrita a técnico. Sem exclusão (fora
    do pedido que originou esta sub-fase)."""
    article = KBArticle(title=payload.title, content=payload.content, category_id=payload.category_id)
    db.add(article)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="category_id inválido") from exc
    db.refresh(article)
    return article


@router.patch(
    "/{article_id}",
    response_model=KBArticleOut,
    dependencies=[Depends(require_role("technician"))],
)
def update_kb_article(article_id: uuid.UUID, payload: KBArticleUpdate, db: Session = Depends(get_db)):
    """Fase 8.4 — edição parcial, restrita a técnico (mesmo padrão de PATCH
    /tickets/{id})."""
    article = db.query(KBArticle).filter(KBArticle.id == article_id).first()
    if article is None:
        raise HTTPException(status_code=404, detail="Artigo não encontrado")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(article, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="category_id inválido") from exc
    db.refresh(article)
    return article
