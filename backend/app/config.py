"""Configuração de acesso a serviços externos (IA de triagem).

Segue o mesmo padrão de app/database.py: variáveis lidas do .env na raiz do
projeto via python-dotenv, sem dependência extra de pydantic-settings.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

# Ausente/vazia => modo mock (heurística local, sem custo de API).
# Presente => modo live (Anthropic Claude).
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY") or None
LLM_MODEL = os.environ.get("LLM_MODEL", "claude-haiku-4-5")
