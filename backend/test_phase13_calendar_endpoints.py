"""
Teste da Fase 13, sub-fase 13.3: endpoints do calendário de horário
comercial — GET/PATCH /business-hours e GET/POST/DELETE /holidays, ambos
restritos a technician/manager.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). Reusa as 7
linhas de business_hours já semeadas (seed_dev_data.py) em vez de criar
linha própria (weekday é único) — edita e restaura o valor original no
finally, mesmo padrão de test_phase10_sla_rules.py.
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import BusinessHours, Holiday, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    technician = User(
        name="Técnico Calendário Teste", email="teste.fase13.calendariotech@example.com",
        role="technician", password_hash="x",
    )
    end_user = User(
        name="Usuário Calendário Teste", email="teste.fase13.calendarioenduser@example.com",
        role="end_user", password_hash="x",
    )
    db.add_all([technician, end_user])
    db.commit()
    for u in (technician, end_user):
        db.refresh(u)

    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}
    user_headers = {"Authorization": f"Bearer {create_access_token(end_user)}"}

    monday = db.query(BusinessHours).filter(BusinessHours.weekday == 0).first()
    assert monday is not None, "seed_dev_data.py precisa ter rodado (business_hours vazia)"
    original = {"is_open": monday.is_open, "start_time": monday.start_time, "end_time": monday.end_time}

    holiday_id = None
    try:
        # --- guards ---
        resp = client.get("/business-hours", headers=user_headers)
        assert resp.status_code == 403, resp.text
        resp = client.get("/holidays", headers=user_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /business-hours e /holidays com usuário final -> 403")

        # --- GET /business-hours: 7 linhas ---
        resp = client.get("/business-hours", headers=tech_headers)
        assert resp.status_code == 200, resp.text
        rows = resp.json()
        assert len(rows) == 7
        assert {r["weekday"] for r in rows} == set(range(7))
        print("[OK] GET /business-hours -> 200, 7 linhas (uma por dia da semana)")

        # --- PATCH: edita horário de um dia aberto ---
        resp = client.patch(
            f"/business-hours/{monday.id}",
            json={"start_time": "09:00:00", "end_time": "17:00:00"},
            headers=tech_headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["start_time"] == "09:00:00"
        assert body["end_time"] == "17:00:00"
        print("[OK] PATCH /business-hours/{id} -> edita start_time/end_time de um dia aberto")

        # --- PATCH: is_open=True sem horário -> 400 ---
        resp = client.patch(f"/business-hours/{monday.id}", json={"is_open": True}, headers=tech_headers)
        # segunda já tem start/end de sobra do PATCH anterior, então este
        # PATCH isolado (só is_open) não dispara o 400 -- testa o caso real:
        # fechar o dia e tentar reabrir sem informar horário junto.
        assert resp.status_code == 200, resp.text

        resp = client.patch(f"/business-hours/{monday.id}", json={"is_open": False}, headers=tech_headers)
        assert resp.status_code == 200, resp.text
        assert resp.json()["start_time"] is None and resp.json()["end_time"] is None
        print("[OK] PATCH is_open=False -> limpa start_time/end_time")

        resp = client.patch(f"/business-hours/{monday.id}", json={"is_open": True}, headers=tech_headers)
        assert resp.status_code == 400, resp.text
        print("[OK] PATCH is_open=True sem start_time/end_time cadastrado -> 400")

        # --- PATCH: start_time >= end_time -> 400 ---
        resp = client.patch(
            f"/business-hours/{monday.id}",
            json={"is_open": True, "start_time": "18:00:00", "end_time": "08:00:00"},
            headers=tech_headers,
        )
        assert resp.status_code == 400, resp.text
        print("[OK] PATCH start_time >= end_time -> 400")

        # --- PATCH: id inexistente -> 404 ---
        resp = client.patch(
            "/business-hours/00000000-0000-0000-0000-000000000000",
            json={"is_open": False},
            headers=tech_headers,
        )
        assert resp.status_code == 404, resp.text
        print("[OK] PATCH /business-hours/{id} inexistente -> 404")

        # --- holidays: cria, lista, duplicata, deleta ---
        resp = client.post(
            "/holidays", json={"date": "2027-01-25", "name": "Feriado de teste Fase 13"}, headers=tech_headers
        )
        assert resp.status_code == 201, resp.text
        holiday_id = resp.json()["id"]
        print(f"[OK] POST /holidays -> 201, holiday={holiday_id}")

        resp = client.get("/holidays", headers=tech_headers)
        assert resp.status_code == 200, resp.text
        assert holiday_id in [h["id"] for h in resp.json()]
        print("[OK] GET /holidays -> 200, encontra o feriado criado")

        resp = client.post(
            "/holidays", json={"date": "2027-01-25", "name": "Duplicata"}, headers=tech_headers
        )
        assert resp.status_code == 400, resp.text
        print("[OK] POST /holidays com data duplicada -> 400")

        resp = client.delete(f"/holidays/{holiday_id}", headers=tech_headers)
        assert resp.status_code == 204, resp.text
        resp = client.get("/holidays", headers=tech_headers)
        assert holiday_id not in [h["id"] for h in resp.json()]
        holiday_id = None
        print("[OK] DELETE /holidays/{id} -> 204, some da listagem")

        resp = client.delete("/holidays/00000000-0000-0000-0000-000000000000", headers=tech_headers)
        assert resp.status_code == 404, resp.text
        print("[OK] DELETE /holidays/{id} inexistente -> 404")

        print("\nTODOS OS TESTES DA FASE 13 (ENDPOINTS DO CALENDÁRIO) PASSARAM")
    finally:
        # restaura segunda-feira pro valor original (seed default)
        db.query(BusinessHours).filter(BusinessHours.id == monday.id).update(original)
        if holiday_id:
            db.query(Holiday).filter(Holiday.id == holiday_id).delete()
        db.query(User).filter(User.id.in_([technician.id, end_user.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: segunda-feira restaurada, dados de teste removidos")


if __name__ == "__main__":
    run()
