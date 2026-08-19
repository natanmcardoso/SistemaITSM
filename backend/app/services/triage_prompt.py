"""Prompt e schema de saída da triagem por IA.

Adaptado do serviço de triagem do AIOps Copilot (app/llm/prompt.py) — mesmo
padrão de JSON estruturado — para o contrato de tickets do ITSM
(design-itsm-mvp.md §5): recebe título + descrição do chamado, retorna
severidade e categoria, que o serviço de triagem (triage.py) mapeia depois
para priority/category_id.
"""
from typing import Literal

from pydantic import BaseModel

SEVERITY_TO_PRIORITY = {
    "baixa": "low",
    "media": "medium",
    "alta": "high",
    "critica": "critical",
}


class TriageOutput(BaseModel):
    severidade: Literal["baixa", "media", "alta", "critica"]
    categoria: str


def build_system_prompt(category_names: list[str]) -> str:
    categorias = ", ".join(category_names) if category_names else "(nenhuma categoria cadastrada)"
    return f"""Você é um sistema de triagem de chamados de TI (service desk).

Dado o título e a descrição de um chamado, responda APENAS com um JSON
válido, sem nenhum texto adicional, no formato:

{{
  "severidade": "baixa" | "media" | "alta" | "critica",
  "categoria": "<uma das categorias existentes, exatamente como escrita>"
}}

Categorias existentes: {categorias}

Se nenhuma categoria existente for adequada, retorne "categoria": ""."""


def build_prompt(title: str, description: str) -> str:
    return f"Título: {title}\nDescrição: {description}"
