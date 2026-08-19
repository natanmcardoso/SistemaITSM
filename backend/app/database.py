"""Configuração de conexão com o banco de dados (SQLAlchemy)."""
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Carrega o .env da raiz do projeto (um nível acima de backend/)
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

def _with_psycopg_driver(url: str) -> str:
    """Força o uso do driver psycopg (v3) em vez do psycopg2 (default do SQLAlchemy)."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _with_psycopg_driver(os.environ["DATABASE_URL"])

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
