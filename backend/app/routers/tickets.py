"""Endpoints core de tickets — CRUD (Fase 2, sem IA ainda).

Triagem por IA (ai_suggested_priority / ai_suggested_category_id) e autenticação
serão plugadas em fases futuras (ver CLAUDE.md — Ordem de execução).
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Ticket
from app.schemas import TicketCreate, TicketDetailOut, TicketOut, TicketUpdate

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.post("", response_model=TicketOut, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        requester_id=payload.requester_id,
        category_id=payload.category_id,
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        status="open",
    )
    db.add(ticket)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="requester_id, category_id ou assignee_id inválido(s)"
        ) from exc
    db.refresh(ticket)
    return ticket


@router.get("", response_model=list[TicketOut])
def list_tickets(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket)
    if status is not None:
        query = query.filter(Ticket.status == status)
    if priority is not None:
        query = query.filter(Ticket.priority == priority)
    if assignee_id is not None:
        query = query.filter(Ticket.assignee_id == assignee_id)
    return query.order_by(Ticket.created_at.desc()).all()


@router.get("/{ticket_id}", response_model=TicketDetailOut)
def get_ticket(ticket_id: uuid.UUID, db: Session = Depends(get_db)):
    ticket = (
        db.query(Ticket)
        .options(selectinload(Ticket.interactions))
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    return ticket


@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket(ticket_id: uuid.UUID, payload: TicketUpdate, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(ticket, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="category_id ou assignee_id inválido(s)"
        ) from exc
    db.refresh(ticket)
    return ticket
