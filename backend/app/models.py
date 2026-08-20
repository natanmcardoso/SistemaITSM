"""Modelo de dados do Sistema ITSM (schema conceitual em design-itsm-mvp.md §3)."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# --- Enums --------------------------------------------------------------

USER_ROLES = ("end_user", "technician", "manager", "admin")
TICKET_STATUSES = ("open", "in_progress", "resolved", "closed")
TICKET_PRIORITIES = ("low", "medium", "high", "critical")
ASSET_TYPES = ("desktop", "notebook", "server", "printer", "network", "other")
ASSET_STATUSES = ("active", "maintenance", "retired")
PROBLEM_STATUSES = ("investigating", "known_error", "resolved")

user_role_enum = Enum(*USER_ROLES, name="user_role")
ticket_status_enum = Enum(*TICKET_STATUSES, name="ticket_status")
ticket_priority_enum = Enum(*TICKET_PRIORITIES, name="ticket_priority")
asset_type_enum = Enum(*ASSET_TYPES, name="asset_type")
asset_status_enum = Enum(*ASSET_STATUSES, name="asset_status")
problem_status_enum = Enum(*PROBLEM_STATUSES, name="problem_status")


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


# --- Tabelas --------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    role: Mapped[str] = mapped_column(user_role_enum, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Group(Base):
    """Administração (Fase 11) — organização/roteamento de usuários, **não**
    controla permissão (Opção A confirmada em CLAUDE.md: "perfil" continua
    sendo o `role` fixo; RBAC granular fica só documentado como evolução
    futura, não implementado)."""

    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserGroup(Base):
    """Associação many-to-many entre users e groups (Fase 11) — PK composta,
    sem coluna `id` própria."""

    __tablename__ = "user_groups"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id"), primary_key=True)


class AuditLog(Base):
    """Trilha de auditoria (Fase 11) — registra ações administrativas
    (CRUD de usuários/grupos). `entity_id` fica nullable pra cobrir ações
    sem um alvo único (ex.: nenhuma prevista ainda, mas evita reabrir o
    schema se aparecer uma)."""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String, nullable=False)
    default_sla_hours: Mapped[int] = mapped_column(Integer, nullable=False)


class Asset(Base):
    """CMDB (Fase 6) — inventário simplificado. Sem CRUD dedicado no MVP desta
    fase: ativos são semeados via script e vinculados a chamados só como
    dado de demonstração pro dashboard (design-itsm-mvp.md, decisão em
    CLAUDE.md — cobre o núcleo de ITIL sem replicar as 34+ práticas do
    framework)."""

    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(asset_type_enum, nullable=False)
    status: Mapped[str] = mapped_column(asset_status_enum, nullable=False, server_default="active")
    owner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Problem(Base):
    """Problem Management (Fase 6) — mesma simplificação de escopo do Asset
    acima: sem CRUD dedicado, só o vínculo com chamados pro dashboard."""

    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = _uuid_pk()
    title: Mapped[str] = mapped_column(String, nullable=False)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(problem_status_enum, nullable=False, server_default="investigating")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = _uuid_pk()
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(ticket_status_enum, nullable=False, server_default="open")
    priority: Mapped[str | None] = mapped_column(ticket_priority_enum, nullable=True)

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # CMDB + Problem Management (Fase 6) — vínculo opcional, sem tela de CRUD
    # dedicada nesta fase (ver Asset/Problem acima)
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True
    )
    problem_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id"), nullable=True
    )

    # Sugestão original da IA — preservada separada do valor final (ver design-itsm-mvp.md §5)
    ai_suggested_priority: Mapped[str | None] = mapped_column(ticket_priority_enum, nullable=True)
    ai_suggested_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )

    resolved_by_ai: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    interactions: Mapped[list["Interaction"]] = relationship(back_populates="ticket")


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ticket: Mapped["Ticket"] = relationship(back_populates="interactions")


class KBArticle(Base):
    __tablename__ = "kb_articles"

    id: Mapped[uuid.UUID] = _uuid_pk()
    title: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )
    times_suggested: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")


class SLARule(Base):
    __tablename__ = "sla_rules"

    id: Mapped[uuid.UUID] = _uuid_pk()
    priority: Mapped[str] = mapped_column(ticket_priority_enum, nullable=False, unique=True)
    response_time_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_time_hours: Mapped[int] = mapped_column(Integer, nullable=False)
