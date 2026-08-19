"""Entrypoint da API FastAPI do Sistema ITSM."""
from fastapi import FastAPI

from app.routers import auth, tickets

app = FastAPI(title="Sistema ITSM API")

app.include_router(auth.router)
app.include_router(tickets.router)


@app.get("/health")
def health():
    return {"status": "ok"}
