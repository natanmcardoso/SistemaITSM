"""Serviço de triagem por IA — ponto de entrada usado pelo router de tickets.

Decide entre modo live (Anthropic, se ANTHROPIC_API_KEY estiver configurada)
e modo mock (heurística local por palavras-chave), classifica o chamado e
mapeia o resultado (severidade/categoria) para os campos do ticket
(priority/category_id), casando a categoria sugerida com as já cadastradas
em `categories` — se nenhuma bater, o chamado segue sem categoria sugerida
em vez de criar uma nova (ver design-itsm-mvp.md §5).
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import ANTHROPIC_API_KEY, LLM_MODEL
from app.models import Category
from app.services.triage_mock import classify_ticket_mock
from app.services.triage_prompt import SEVERITY_TO_PRIORITY
from app.services.triage_provider import classify_ticket, make_anthropic_llm_call


@dataclass
class TriageResult:
    priority: str | None
    category_id: object | None  # uuid.UUID | None
    mode: str  # "live" | "mock"


def is_live_mode() -> bool:
    return bool(ANTHROPIC_API_KEY)


def triage_ticket(title: str, description: str, db: Session) -> TriageResult:
    categories = db.query(Category).all()
    category_by_name = {c.name.lower(): c.id for c in categories}
    category_names = [c.name for c in categories]

    if is_live_mode():
        llm_call = make_anthropic_llm_call(LLM_MODEL, category_names)
        result = classify_ticket(title, description, llm_call)
        mode = "live"
    else:
        result = classify_ticket_mock(title, description, category_names)
        mode = "mock"

    priority = SEVERITY_TO_PRIORITY.get(result["severidade"])
    category_id = category_by_name.get(result["categoria"].strip().lower())

    return TriageResult(priority=priority, category_id=category_id, mode=mode)
