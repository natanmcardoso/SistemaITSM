"""Trilha de auditoria (Fase 11) — grava uma entrada em `audit_log` pra ações
administrativas (CRUD de usuários/grupos). Não commita sozinho: quem chama
adiciona a entrada à mesma sessão/transação da mudança principal (ex.: criar
usuário + registrar `create_user`) e comita os dois juntos — se um falhar, o
outro também não persiste.
"""
import uuid

from sqlalchemy.orm import Session

from app.models import AuditLog, User


def log_action(
    db: Session,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | None = None,
    details: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=actor.id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(entry)
    return entry
