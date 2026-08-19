"""Classificador mock por palavras-chave.

Usado quando ANTHROPIC_API_KEY não está configurada, pra testar o fluxo de
triagem de ponta a ponta sem custo de API real. Mesmo espírito do modo mock
do AIOps Copilot, mas por regras simples em vez de fixtures — aqui os
chamados são texto livre do usuário, não um dataset sintético fixo.
"""

# (palavras-chave, severidade, categoria) — primeira regra cujo termo
# aparecer no texto (título + descrição) vence.
_RULES: list[tuple[list[str], str, str]] = [
    (["urgente", "crítico", "critico", "parado", "produção", "producao", "fora do ar"], "critica", "Infraestrutura"),
    (["não liga", "nao liga", "tela azul", "notebook", "monitor", "impressora"], "alta", "Hardware"),
    (["senha", "acesso", "login", "bloqueado"], "media", "Acesso"),
    (["lento", "lentidão", "lentidao", "travando"], "media", "Performance"),
]
_DEFAULT_SEVERITY = "media"
_DEFAULT_CATEGORY = "Geral"


def classify_ticket_mock(title: str, description: str, category_names: list[str]) -> dict:
    text = f"{title} {description}".lower()

    for keywords, severidade, categoria in _RULES:
        if any(kw in text for kw in keywords):
            return {"severidade": severidade, "categoria": _match_category(categoria, category_names) or categoria}

    return {
        "severidade": _DEFAULT_SEVERITY,
        "categoria": _match_category(_DEFAULT_CATEGORY, category_names) or _DEFAULT_CATEGORY,
    }


def _match_category(name: str, category_names: list[str]) -> str | None:
    for existing in category_names:
        if existing.lower() == name.lower():
            return existing
    return None
