"""Schemas Pydantic para a API de tickets (Fase 2 — CRUD, sem IA ainda)."""
import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

TicketStatus = Literal["open", "in_progress", "resolved", "closed"]
TicketPriority = Literal["low", "medium", "high", "critical"]


class InteractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticket_id: uuid.UUID
    author_id: uuid.UUID
    content: str
    created_at: datetime


class TicketCreate(BaseModel):
    title: str
    description: str
    requester_id: uuid.UUID
    category_id: Optional[uuid.UUID] = None
    priority: Optional[TicketPriority] = None
    assignee_id: Optional[uuid.UUID] = None


class TicketUpdate(BaseModel):
    """Todos os campos opcionais — PATCH parcial."""

    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    category_id: Optional[uuid.UUID] = None
    assignee_id: Optional[uuid.UUID] = None


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    status: TicketStatus
    priority: Optional[TicketPriority]
    category_id: Optional[uuid.UUID]
    requester_id: uuid.UUID
    assignee_id: Optional[uuid.UUID]
    ai_suggested_priority: Optional[TicketPriority]
    ai_suggested_category_id: Optional[uuid.UUID]
    resolved_by_ai: bool
    sla_due_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class TicketDetailOut(TicketOut):
    interactions: list[InteractionOut] = []
