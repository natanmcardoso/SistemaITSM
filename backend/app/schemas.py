"""Schemas Pydantic para a API de tickets (Fase 2 — CRUD, sem IA ainda)."""
import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

TicketStatus = Literal["open", "in_progress", "resolved", "closed"]
TicketPriority = Literal["low", "medium", "high", "critical"]
UserRole = Literal["end_user", "technician", "manager"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    role: UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class InteractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticket_id: uuid.UUID
    author_id: uuid.UUID
    content: str
    created_at: datetime


class InteractionCreate(BaseModel):
    content: str = Field(min_length=1)


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


class KBArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str
    category_id: Optional[uuid.UUID]
    times_suggested: int


class CategoryCount(BaseModel):
    name: str
    count: int


class AIAccuracyMetric(BaseModel):
    """Sugerida vs. valor final — mede o acerto da IA (design-itsm-mvp.md §5).

    Só considera chamados em que a IA de fato sugeriu algo (suggested_total);
    matched = técnico manteve a sugestão, changed = reclassificou.
    """

    suggested_total: int
    matched: int
    changed: int


class SLAMetric(BaseModel):
    """Chamados com `sla_due_at` calculado (sub-fase SLA, pós tela 3/3).

    tracked_total = chamados com sla_due_at preenchido (têm prioridade
    reconhecida em sla_rules); breached = desses, quantos já passaram do
    prazo e ainda não foram resolvidos/fechados.
    """

    tracked_total: int
    breached: int


class AIResolutionMetric(BaseModel):
    """% de chamados resolvidos pelo usuário via sugestão da IA, sem técnico
    (design-itsm-mvp.md §2.3 — a métrica central do diferencial do projeto).
    """

    total_tickets: int
    resolved_by_ai: int


class DashboardSummary(BaseModel):
    """Fase 4, tela 3/3 + sub-fases SLA e resolve-by-user — as 4 métricas
    centrais do design doc (§2.3) reais.
    """

    total_tickets: int
    by_status: dict[str, int]
    top_categories: list[CategoryCount]
    ai_accuracy_priority: AIAccuracyMetric
    ai_accuracy_category: AIAccuracyMetric
    sla: SLAMetric
    ai_resolution: AIResolutionMetric
