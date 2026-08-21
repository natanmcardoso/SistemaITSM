"""Monitoramento (Fase 17) — saúde do próprio sistema (uptime, taxa de
erro), não dos `assets` do CMDB nem RMM. Restrito a role=manager (decisão
confirmada com o usuário — estende a persona que já tem
Dashboard/Relatórios/Automações, em vez de ir para o admin).
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RequestLog
from app.schemas import MonitoringSummary
from app.security import require_role

router = APIRouter(prefix="/monitoring", tags=["monitoring"], dependencies=[Depends(require_role("manager"))])

# Momento em que este módulo foi importado — coincide com o boot do
# processo (main.py importa todos os routers na inicialização). Em memória
# de propósito (decisão confirmada com o usuário: literal "tempo no ar
# desde o último restart", sem persistir isso — o que fica persistido é o
# log de requisições, RequestLog, abaixo).
APP_START_TIME = datetime.now(timezone.utc)

_ERROR_STATUS_THRESHOLD = 500


@router.get("/summary", response_model=MonitoringSummary)
def get_monitoring_summary(window_hours: int = Query(24, gt=0, le=24 * 30), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=window_hours)

    # Sempre filtrado pela janela — nunca a tabela inteira (ver docstring de
    # RequestLog em app/models.py sobre a ausência de rotina de limpeza).
    base_query = db.query(RequestLog).filter(RequestLog.created_at >= window_start)
    total_requests = base_query.count()
    error_requests = base_query.filter(RequestLog.status_code >= _ERROR_STATUS_THRESHOLD).count()
    error_rate_percent = round(error_requests / total_requests * 100, 2) if total_requests > 0 else 0.0

    recent_errors = (
        base_query.filter(RequestLog.status_code >= _ERROR_STATUS_THRESHOLD)
        .order_by(RequestLog.created_at.desc())
        .limit(20)
        .all()
    )

    return MonitoringSummary(
        uptime_since=APP_START_TIME,
        uptime_seconds=int((now - APP_START_TIME).total_seconds()),
        window_hours=window_hours,
        total_requests=total_requests,
        error_requests=error_requests,
        error_rate_percent=error_rate_percent,
        recent_errors=recent_errors,
    )
