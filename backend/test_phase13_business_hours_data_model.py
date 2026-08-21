"""
Teste da Fase 13, sub-fase 13.1: modelo de dados do calendário de horário
comercial (tabelas `business_hours` + `holidays`).

Sem endpoint/motor de cálculo nesta sub-fase (fica pra 13.2/13.3) — o teste
só confirma que o schema existe de verdade (migration já aplicada): criar as
7 linhas de business_hours (uma por dia da semana), um feriado, e reler.

Roda contra o banco real (Neon) e limpa os dados de teste ao final.
"""
from datetime import date, time

from app.database import SessionLocal
from app.models import BusinessHours, Holiday


def run():
    db = SessionLocal()
    weekday_ids = []
    holiday_id = None
    try:
        # --- business_hours: 1 linha por dia (weekday único) ---
        for weekday in range(7):
            is_open = weekday < 5  # segunda(0)-sexta(4) abertos, sábado/domingo fechados
            bh = BusinessHours(
                weekday=weekday,
                is_open=is_open,
                start_time=time(8, 0) if is_open else None,
                end_time=time(18, 0) if is_open else None,
            )
            db.add(bh)
            db.flush()
            weekday_ids.append(bh.id)
        db.commit()
        print("[OK] business_hours: 7 linhas criadas (seg-sex abertas 08h-18h, sáb/dom fechados)")

        # --- releitura ---
        db.expire_all()
        monday = db.query(BusinessHours).filter(BusinessHours.weekday == 0).first()
        assert monday is not None
        assert monday.is_open is True
        assert monday.start_time == time(8, 0)
        assert monday.end_time == time(18, 0)
        saturday = db.query(BusinessHours).filter(BusinessHours.weekday == 5).first()
        assert saturday is not None
        assert saturday.is_open is False
        assert saturday.start_time is None
        assert saturday.end_time is None
        print("[OK] releitura: dias abertos/fechados persistidos corretamente")

        # --- weekday único: segunda linha pro mesmo weekday deve falhar ---
        duplicate = BusinessHours(weekday=0, is_open=True, start_time=time(9, 0), end_time=time(17, 0))
        db.add(duplicate)
        try:
            db.flush()
            raise AssertionError("deveria ter falhado por weekday duplicado")
        except Exception as exc:
            assert "unique" in str(exc).lower() or "duplicate" in str(exc).lower()
            db.rollback()
            print("[OK] business_hours: weekday único, duplicata barrada pelo schema")

        # (rollback já limpou weekday_ids da sessão -- refaz o commit anterior, já persistido)

        # --- holidays ---
        holiday = Holiday(date=date(2026, 9, 7), name="Independência do Brasil (teste)")
        db.add(holiday)
        db.commit()
        holiday_id = holiday.id
        print(f"[OK] holidays: criado holiday={holiday.id} ({holiday.name})")

        db.expire_all()
        reloaded = db.get(Holiday, holiday.id)
        assert reloaded is not None
        assert reloaded.date == date(2026, 9, 7)
        print("[OK] releitura: holiday persistido corretamente")

        # --- date único: mesmo dia de novo deve falhar ---
        duplicate_holiday = Holiday(date=date(2026, 9, 7), name="Duplicata")
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
        if weekday_ids:
            db.query(BusinessHours).filter(BusinessHours.id.in_(weekday_ids)).delete(synchronize_session=False)
        if holiday_id:
            db.query(Holiday).filter(Holiday.id == holiday_id).delete()
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
