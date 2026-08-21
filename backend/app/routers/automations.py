"""Automações (Fase 16) — GET/PATCH /automation-rules e GET /notifications,
ambos restritos a role=manager (é quem o design doc pede pra notificar).

1 regra fixa ("chamado perto de estourar o SLA"), só o limiar editável —
mesmo padrão de SLARule/BusinessHours (Fase 10/13): sem POST, `key` não é
editável. Sem tabela de notificações persistida: GET /notifications
recalcula sob demanda a cada chamada, mesmo padrão já usado pra "SLA
estourado" no dashboard — decisão confirmada com o usuário (sem
scheduler/job em background nesta fase).
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TICKET_STATUSES, AutomationRule, Ticket
from app.schemas import AutomationNotification, AutomationRuleOut, AutomationRuleUpdate
from app.security import require_role

router = APIRouter(tags=["automations"], dependencies=[Depends(require_role("manager"))])

_OPEN_STATUSES = [s for s in TICKET_STATUSES if s not in ("resolved", "closed")]


@router.get("/automation-rules", response_model=list[AutomationRuleOut])
def list_automation_rules(db: Session = Depends(get_db)):
    return db.query(AutomationRule).order_by(AutomationRule.key).all()


@router.patch("/automation-rules/{rule_id}", response_model=AutomationRuleOut)
def update_automation_rule(rule_id: uuid.UUID, payload: AutomationRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="Regra de automação não encontrada")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(rule, field, value)

    db.commit()
    db.refresh(rule)
    return rule


@router.get("/notifications", response_model=list[AutomationNotification])
def list_notifications(db: Session = Depends(get_db)):
    rule = db.query(AutomationRule).filter(AutomationRule.key == "sla_near_breach").first()
    if rule is None or not rule.enabled:
        return []

    now = datetime.now(timezone.utc)
    tickets = (
        db.query(Ticket)
        .filter(Ticket.sla_due_at.isnot(None), Ticket.status.in_(_OPEN_STATUSES))
        .all()
    )

    notifications = []
    for t in tickets:
        total_seconds = (t.sla_due_at - t.created_at).total_seconds()
        if total_seconds <= 0:
            continue
        elapsed_seconds = (now - t.created_at).total_seconds()
        elapsed_percent = int(elapsed_seconds / total_seconds * 100)
        if elapsed_percent < rule.threshold_percent:
            continue
        notifications.append(
            AutomationNotification(
                ticket_id=t.id,
                title=t.title,
                priority=t.priority,
                sla_due_at=t.sla_due_at,
                elapsed_percent=elapsed_percent,
                breached=t.sla_due_at < now,
            )
        )

    notifications.sort(key=lambda n: n.elapsed_percent, reverse=True)
    return notifications
