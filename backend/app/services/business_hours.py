"""Motor de cálculo de horário comercial (Fase 13) — função pura, sem
dependência de banco, de propósito: é a peça de maior risco da fase (reabre
o cálculo de `sla_due_at` já fechado desde a Fase 4), então fica isolada e
testada exaustivamente (test_phase13_business_hours_calc.py) antes de ser
plugada em qualquer lugar que mexe com dado real (app/services/sla.py).

Fuso horário fixo — `BUSINESS_TIMEZONE` — decisão de escopo: não é
configurável nesta fase (mesmo espírito "núcleo, não o framework inteiro" já
usado no CMDB e no Catálogo de Serviços). Os horários guardados em
business_hours/holidays são interpretados neste fuso. Brasil não observa
horário de verão desde 2019, então não há ambiguidade de "dia com 23/25h"
pra tratar aqui.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")

# Guarda contra configuração inválida (ex.: todos os dias fechados) que
# faria a busca nunca encontrar uma janela aberta — mesmo padrão de
# degradação graciosa (devolve None) já usado em compute_sla_due_at quando
# não há regra de SLA cadastrada pra uma prioridade.
_MAX_DAYS_LOOKAHEAD = 3660  # ~10 anos


@dataclass(frozen=True)
class DayWindow:
    """Janela de horário comercial de um dia da semana. `start`/`end` só têm
    sentido quando `is_open=True`."""

    is_open: bool
    start: time | None = None
    end: time | None = None


def add_business_hours(
    from_time_utc: datetime,
    hours: float,
    windows_by_weekday: dict[int, DayWindow],
    holidays: set[date],
) -> datetime | None:
    """Soma `hours` de horário comercial a partir de `from_time_utc` (aware,
    UTC), pulando dias fechados, feriados e as horas fora da janela do dia.

    `windows_by_weekday` usa a convenção de `datetime.weekday()`
    (0=segunda...6=domingo); um dia ausente do dict é tratado como fechado.

    Devolve `None` se nenhuma janela aberta for encontrada dentro do
    horizonte de busca (configuração inválida, ex. todos os dias fechados)
    — em vez de travar num loop infinito.
    """
    if hours <= 0:
        return from_time_utc

    remaining = timedelta(hours=hours)
    local = from_time_utc.astimezone(BUSINESS_TIMEZONE)

    for _ in range(_MAX_DAYS_LOOKAHEAD):
        window = windows_by_weekday.get(local.weekday())
        day_is_open = window is not None and window.is_open and local.date() not in holidays

        if day_is_open:
            window_start = datetime.combine(local.date(), window.start, tzinfo=BUSINESS_TIMEZONE)
            window_end = datetime.combine(local.date(), window.end, tzinfo=BUSINESS_TIMEZONE)
            # Se `local` cai antes da janela abrir (ou vindo de um dia
            # anterior), o cursor avança pro início dela; se já é depois que
            # fechou, o bloco abaixo é pulado (cursor >= window_end).
            cursor = max(local, window_start)
            if cursor < window_end:
                available = window_end - cursor
                if remaining <= available:
                    return (cursor + remaining).astimezone(timezone.utc)
                remaining -= available

        # Avança pro início do próximo dia (meia-noite local) e repete.
        local = datetime.combine(local.date() + timedelta(days=1), time(0, 0), tzinfo=BUSINESS_TIMEZONE)

    return None
