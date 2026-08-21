"""Entrypoint da API FastAPI do Sistema ITSM."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    services,
    sla_rules,
    tickets,
    users,
)

app = FastAPI(title="Sistema ITSM API")

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


@app.get("/health")
def health():
    return {"status": "ok"}
