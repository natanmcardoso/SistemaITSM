"""Base de conhecimento (Fase 4, sub-fase resolve-by-user).

Simplificação de escopo registrada no CLAUDE.md: o design doc (§5) imagina a
IA de triagem já devolvendo o artigo sugerido junto com categoria/prioridade.
Aqui a sugestão é feita casando por `category_id` (sem envolver a IA) — não
mexe no serviço de triagem já fechado e testado (app/services/triage.py).

`GET /kb-articles` também é o endpoint de busca do design doc (§4), mas com
filtro por `category_id` em vez de busca livre por `query` — não há caso de
uso hoje que precise de busca textual.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import KBArticle
from app.schemas import KBArticleOut
from app.security import get_current_user

router = APIRouter(prefix="/kb-articles", tags=["kb-articles"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[KBArticleOut])
def list_kb_articles(category_id: Optional[uuid.UUID] = Query(None), db: Session = Depends(get_db)):
    query = db.query(KBArticle)
    if category_id is not None:
        query = query.filter(KBArticle.category_id == category_id)
    return query.order_by(KBArticle.times_suggested.desc()).all()


@router.get("/{article_id}", response_model=KBArticleOut)
def get_kb_article(article_id: uuid.UUID, db: Session = Depends(get_db)):
    article = db.query(KBArticle).filter(KBArticle.id == article_id).first()
    if article is None:
        raise HTTPException(status_code=404, detail="Artigo não encontrado")
    return article
