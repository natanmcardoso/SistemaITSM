"""Trilha de auditoria (Fase 11, sub-fase 11.2) — GET /audit-log, restrito a
role=admin. Sem filtros nesta primeira versão (dataset pequeno de portfólio,
mesmo raciocínio de simplicidade já aplicado em GET /sla-rules)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog
from app.schemas import AuditLogOut
from app.security import require_role

router = APIRouter(prefix="/audit-log", tags=["audit-log"], dependencies=[Depends(require_role("admin"))])


@router.get("", response_model=list[AuditLogOut])
def list_audit_log(db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).all()
