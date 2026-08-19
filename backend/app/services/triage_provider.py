"""Chamada ao LLM (modo live) para triagem de chamados.

Reaproveita o padrão do AIOps Copilot (app/llm/live_provider.py): parse
estrito do JSON, uma tentativa de retry pedindo reformatação, e fallback
seguro que nunca derruba a criação do chamado caso a IA falhe ou responda
fora do formato esperado.
"""
import json
import re
from typing import Callable

from pydantic import ValidationError

from app.services.triage_prompt import TriageOutput, build_prompt, build_system_prompt

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)

FALLBACK_TRIAGE = {"severidade": "media", "categoria": ""}


def make_anthropic_llm_call(model: str, category_names: list[str]) -> Callable[[str], str]:
    """Chamada real à Anthropic. Import de `anthropic` fica local à função,
    só é usado no modo live — evita dependência obrigatória em modo mock.
    """
    import anthropic

    client = anthropic.Anthropic()
    system_prompt = build_system_prompt(category_names)

    def llm_call(prompt: str) -> str:
        message = client.messages.create(
            model=model,
            max_tokens=256,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    return llm_call


def _strip_code_fences(raw: str) -> str:
    return _CODE_FENCE_RE.sub("", raw.strip()).strip()


def _parse(raw: str) -> TriageOutput:
    data = json.loads(_strip_code_fences(raw))
    return TriageOutput.model_validate(data)


def classify_ticket(title: str, description: str, llm_call: Callable[[str], str]) -> dict:
    prompt = build_prompt(title, description)

    try:
        raw = llm_call(prompt)
    except Exception:
        return dict(FALLBACK_TRIAGE)

    try:
        return _parse(raw).model_dump()
    except (json.JSONDecodeError, ValidationError) as error:
        retry_prompt = (
            f"{prompt}\n\nSua resposta anterior não era um JSON válido no formato "
            f"esperado (erro: {error}). Responda novamente, apenas com o JSON."
        )
        try:
            raw_retry = llm_call(retry_prompt)
        except Exception:
            return dict(FALLBACK_TRIAGE)

        try:
            return _parse(raw_retry).model_dump()
        except (json.JSONDecodeError, ValidationError):
            return dict(FALLBACK_TRIAGE)
