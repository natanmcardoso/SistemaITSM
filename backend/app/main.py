"""Entrypoint da API FastAPI do Sistema ITSM."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, tickets

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


@app.get("/health")
def health():
    return {"status": "ok"}
