"""
Teste da Fase 13, sub-fase 13.2: motor de cálculo de horário comercial
(app/services/business_hours.py::add_business_hours).

Função pura, sem banco — testada exaustivamente aqui, isolada, antes de ser
plugada em app/services/sla.py (sub-fase 13.3), porque é a peça de maior
risco da fase: reabre o cálculo de `sla_due_at` já fechado desde a Fase 4.

Calendário de teste: segunda-sexta 08h-18h (América/São Paulo), sábado e
domingo fechados — mesmos valores do seed default da sub-fase 13.1.
"""
from datetime import date, datetime, time, timedelta, timezone

from app.services.business_hours import BUSINESS_TIMEZONE, DayWindow, add_business_hours

WEEKDAY_WINDOWS = {
    0: DayWindow(True, time(8, 0), time(18, 0)),  # segunda
    1: DayWindow(True, time(8, 0), time(18, 0)),  # terça
    2: DayWindow(True, time(8, 0), time(18, 0)),  # quarta
    3: DayWindow(True, time(8, 0), time(18, 0)),  # quinta
    4: DayWindow(True, time(8, 0), time(18, 0)),  # sexta
    5: DayWindow(False),  # sábado
    6: DayWindow(False),  # domingo
}

ALL_CLOSED = {i: DayWindow(False) for i in range(7)}


def _next_weekday(start: date, weekday: int) -> date:
    """Primeira data >= start cujo .weekday() == weekday."""
    delta = (weekday - start.weekday()) % 7
    return start + timedelta(days=delta)


def combine_helper(d: date, h: int, m: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, h, m, tzinfo=BUSINESS_TIMEZONE)


def run():
    # Segunda-feira de referência (data qualquer, calculada — não depende de
    # eu acertar de cabeça o dia da semana de uma data hardcoded).
    monday = _next_weekday(date(2026, 1, 1), 0)
    tuesday = monday + timedelta(days=1)
    wednesday = monday + timedelta(days=2)
    thursday = monday + timedelta(days=3)
    friday = monday + timedelta(days=4)
    next_monday = monday + timedelta(days=7)

    # --- A: mesmo dia, no meio da janela ---
    result = add_business_hours(combine_helper(monday, 10, 0), 4, WEEKDAY_WINDOWS, set())
    assert result is not None
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(monday, 14, 0)
    print("[OK] A: segunda 10h + 4h -> segunda 14h (mesmo dia)")

    # --- B: estoura a janela, sobra pro próximo dia aberto ---
    result = add_business_hours(combine_helper(monday, 17, 0), 4, WEEKDAY_WINDOWS, set())
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(tuesday, 11, 0)
    print("[OK] B: segunda 17h + 4h -> 1h segunda + 3h terça = terça 11h")

    # --- C: começa antes da janela abrir (mesmo dia) ---
    result = add_business_hours(combine_helper(monday, 5, 0), 2, WEEKDAY_WINDOWS, set())
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(monday, 10, 0)
    print("[OK] C: segunda 05h (antes de abrir) + 2h -> segunda 10h (conta a partir das 08h)")

    # --- D: começa depois que a janela fechou (mesmo dia) ---
    result = add_business_hours(combine_helper(monday, 20, 0), 2, WEEKDAY_WINDOWS, set())
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(tuesday, 10, 0)
    print("[OK] D: segunda 20h (depois de fechar) + 2h -> terça 10h (rola pro próximo dia aberto)")

    # --- E: atravessa o fim de semana ---
    result = add_business_hours(combine_helper(friday, 17, 0), 4, WEEKDAY_WINDOWS, set())
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(next_monday, 11, 0)
    print("[OK] E: sexta 17h + 4h -> 1h sexta + pula sáb/dom + 3h segunda seguinte = 11h")

    # --- F: atravessa um feriado ---
    result = add_business_hours(combine_helper(wednesday, 17, 0), 9, WEEKDAY_WINDOWS, {thursday})
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(friday, 16, 0)
    print("[OK] F: quarta 17h + 9h, quinta é feriado -> 1h quarta + pula quinta + 8h sexta = 16h")

    # --- G: hours=0 devolve o instante original (sem alterar) ---
    original = combine_helper(monday, 10, 0)
    result = add_business_hours(original, 0, WEEKDAY_WINDOWS, set())
    assert result == original
    print("[OK] G: hours=0 -> devolve o instante original sem alteração")

    # --- H: preenche a janela exatamente até o fim ---
    result = add_business_hours(combine_helper(monday, 8, 0), 10, WEEKDAY_WINDOWS, set())
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(monday, 18, 0)
    print("[OK] H: segunda 08h + 10h (janela cheia) -> segunda 18h exatas (limite inclusive)")

    # --- I: começa exatamente no fechamento -> conta como fora da janela ---
    result = add_business_hours(combine_helper(monday, 18, 0), 1, WEEKDAY_WINDOWS, set())
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(tuesday, 9, 0)
    print("[OK] I: segunda 18h (exatamente o fechamento) + 1h -> terça 09h (não conta como aberto)")

    # --- J: configuração inválida (todo mundo fechado) -> None, sem travar ---
    result = add_business_hours(combine_helper(monday, 10, 0), 1, ALL_CLOSED, set())
    assert result is None
    print("[OK] J: todos os dias fechados -> None (degradação graciosa, sem loop infinito)")

    # --- K: várias semanas, cruzando 1 fim de semana inteiro ---
    # 5 dias úteis cheios (50h) esgota exatamente seg-sex; sobra 10h ->
    # próxima segunda inteira -> due na segunda seguinte às 18h.
    result = add_business_hours(combine_helper(monday, 8, 0), 60, WEEKDAY_WINDOWS, set())
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(next_monday, 18, 0)
    print("[OK] K: segunda 08h + 60h (6 dias úteis) -> pula 1 fim de semana -> segunda seguinte 18h")

    # --- L: input em UTC de verdade (é o que vem do banco) -> conversão correta ---
    # América/São Paulo é UTC-3 fixo (sem horário de verão desde 2019) ->
    # segunda 10h local = segunda 13h UTC.
    from_utc = datetime(monday.year, monday.month, monday.day, 13, 0, tzinfo=timezone.utc)
    result = add_business_hours(from_utc, 4, WEEKDAY_WINDOWS, set())
    assert result.tzinfo is not None
    assert result.astimezone(BUSINESS_TIMEZONE) == combine_helper(monday, 14, 0)
    assert result.astimezone(timezone.utc) == datetime(monday.year, monday.month, monday.day, 17, 0, tzinfo=timezone.utc)
    print("[OK] L: input em UTC de verdade (13h UTC = 10h local) + 4h -> 14h local = 17h UTC")

    print("\nTODOS OS TESTES DA FASE 13 (MOTOR DE HORÁRIO COMERCIAL) PASSARAM")


if __name__ == "__main__":
    run()
