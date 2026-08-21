"""Entrypoint da API FastAPI do Sistema ITSM."""
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal
from app.models import RequestLog
from app.routers import (
    audit_log,
    automations,
    auth,
    business_hours,
    categories,
    dashboard,
    groups,
    holidays,
    kb_articles,
    monitoring,
    services,
    sla_rules,
    tickets,
    users,
)

app = FastAPI(title="Sistema ITSM API")


# Monitoramento (Fase 17) — log persistido de toda requisição (exceto
# /health, ping de infra sem significado de negócio), pra alimentar
# GET /monitoring/summary. Decisão confirmada com o usuário: log persistido
# em vez de contador em memória (sobrevive a restart do backend, rotina
# neste projeto — ver CLAUDE.md), mesmo sem scheduler pra isso; a escrita
# acontece inline aqui, com sessão própria (independente da sessão de
# get_db do endpoint) e sem deixar uma falha de log derrubar a requisição
# real. Também captura exceção não tratada como status 500 antes de
# repropagar, pra aparecer em "erros recentes" mesmo quando nenhum
# HTTPException explícito gerou o 500.
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    try:
        response = await call_next(request)
    except Exception:
        _log_request(request, 500, time.monotonic() - start)
        raise
    _log_request(request, response.status_code, time.monotonic() - start)
    return response


def _log_request(request: Request, status_code: int, elapsed_seconds: float) -> None:
    if request.url.path == "/health":
        return
    db = SessionLocal()
    try:
        db.add(
            RequestLog(
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                duration_ms=int(elapsed_seconds * 1000),
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

# Fase 4 (frontend): Vite roda em localhost:5173 por padrão. Lista fechada de
# origins de dev — não usar "*" porque o login manda credenciais (JWT).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tickets.router)
app.include_router(dashboard.router)
app.include_router(kb_articles.router)
app.include_router(categories.router)
app.include_router(services.router)
app.include_router(sla_rules.router)
app.include_router(business_hours.router)
app.include_router(holidays.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(audit_log.router)
app.include_router(automations.router)
app.include_router(monitoring.router)


@app.get("/health")
def health():
    return {"status": "ok"}
