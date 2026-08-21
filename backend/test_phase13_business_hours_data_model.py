"""
Teste da Fase 13, sub-fase 13.1: modelo de dados do calendário de horário
comercial (tabelas `business_hours` + `holidays`).

Sem endpoint/motor de cálculo nesta sub-fase (fica pra 13.2/13.3) — o teste
só confirma que o schema existe de verdade (migration já aplicada).

`weekday` e `date` são únicos e, depois que seed_dev_data.py roda, as 7
linhas de business_hours (uma por dia) e os feriados default já existem no
banco — então este teste reusa o que já está semeado em vez de tentar criar
de novo (mesmo padrão "reusa se existir, só limpa se criou" já usado em
SLARule/Category, ver CLAUDE.md). O teste de holiday usa uma data que
certamente não colide com o seed (bem no futuro, fora da lista semeada).

Roda contra o banco real (Neon) e limpa só os dados que criou.
"""
from datetime import date, time

from app.database import SessionLocal
from app.models import BusinessHours, Holiday

TEST_HOLIDAY_DATE = date(2099, 3, 3)  # não colide com nenhum feriado do seed


def run():
    db = SessionLocal()
    holiday_id = None
    try:
        # --- business_hours: confirma que as 7 linhas (seed ou pré-existentes) estão lá ---
        rows = db.query(BusinessHours).order_by(BusinessHours.weekday).all()
        assert len(rows) == 7, f"esperava 7 linhas de business_hours (1 por dia), achei {len(rows)}"
        assert {r.weekday for r in rows} == set(range(7))
        print("[OK] business_hours: 7 linhas presentes, uma por dia da semana (0-6)")

        monday = next(r for r in rows if r.weekday == 0)
        assert monday.is_open is True
        assert monday.start_time is not None and monday.end_time is not None
        print(f"[OK] business_hours: segunda aberta {monday.start_time}-{monday.end_time}")

        # --- weekday único: inserir de novo pro mesmo dia falha ---
        duplicate = BusinessHours(weekday=0, is_open=True, start_time=time(9, 0), end_time=time(17, 0))
        db.add(duplicate)
        try:
            db.flush()
            raise AssertionError("deveria ter falhado por weekday duplicado")
        except Exception as exc:
            assert "unique" in str(exc).lower() or "duplicate" in str(exc).lower()
            db.rollback()
            print("[OK] business_hours: weekday único, duplicata barrada pelo schema")

        # --- holidays: cria um novo (data que não colide com o seed) ---
        holiday = Holiday(date=TEST_HOLIDAY_DATE, name="Feriado de teste Fase 13 (modelo de dados)")
        db.add(holiday)
        db.commit()
        holiday_id = holiday.id
        print(f"[OK] holidays: criado holiday={holiday.id} ({holiday.name})")

        db.expire_all()
        reloaded = db.get(Holiday, holiday.id)
        assert reloaded is not None
        assert reloaded.date == TEST_HOLIDAY_DATE
        print("[OK] releitura: holiday persistido corretamente")

        # --- date único: mesmo dia de novo deve falhar ---
        duplicate_holiday = Holiday(date=TEST_HOLIDAY_DATE, name="Duplicata")
        db.add(duplicate_holiday)
        try:
            db.flush()
            raise AssertionError("deveria ter falhado por date duplicado")
        except Exception as exc:
            assert "unique" in str(exc).lower() or "duplicate" in str(exc).lower()
            db.rollback()
            print("[OK] holidays: date único, duplicata barrada pelo schema")

        print("\nTODOS OS TESTES DA FASE 13 (MODELO DE DADOS DO CALENDÁRIO) PASSARAM")
    finally:
        db.rollback()
        if holiday_id:
            db.query(Holiday).filter(Holiday.id == holiday_id).delete()
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos (business_hours semeada não é tocada)")


if __name__ == "__main__":
    run()
