"""
Teste da Fase 4 (sub-fase SLA): cálculo de sla_due_at na criação/atualização
de chamados + métrica de SLA estourado no dashboard.

Desde a Fase 13, `sla_due_at` é calculado em horário comercial (não mais
corrido/24-7) — o "esperado" de cada asserção é recalculado aqui chamando o
mesmo motor de horário comercial (app/services/business_hours.py) usado em
produção, com o calendário real lido do banco. Continua sendo um teste de
integração de verdade (confere que POST/PATCH /tickets chamam
compute_sla_due_at com os parâmetros certos), não um teste da lógica de
cálculo em si — essa já é coberta exaustivamente, isolada, em
test_phase13_business_hours_calc.py.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). `SLARule`
tem `priority` único (só 4 valores possíveis no enum), então o teste reusa a
regra já cadastrada pra cada prioridade quando existir (ex.: seed_dev_data.py
já rodou) e só cria uma própria quando faltar — sem depender de nenhuma
ordem de execução dos outros scripts.

Valida:
- POST /tickets com priority explícita -> sla_due_at ~= created_at +
  resolution_time_hours da regra daquela prioridade, em horário comercial.
- PATCH priority -> sla_due_at recalcula a partir da CRIAÇÃO do chamado
  (não do instante do PATCH — não dá pra "resetar o relógio" reclassificando).
- GET /dashboard/summary.sla reflete um chamado com SLA estourado (via
  delta antes/depois, como o resto do dashboard).
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import BusinessHours, Holiday, SLARule, Ticket, User
from app.security import create_access_token
from app.services.business_hours import DayWindow, add_business_hours

client = TestClient(app)

TOLERANCE = timedelta(minutes=2)


def _load_calendar(db):
    windows = {
        row.weekday: DayWindow(row.is_open, row.start_time, row.end_time)
        for row in db.query(BusinessHours).all()
    }
    holidays = {row.date for row in db.query(Holiday).all()}
    return windows, holidays


def _ensure_rule(db, priority: str, resolution_hours: int):
    """Garante uma sla_rule pra essa priority; devolve (resolution_hours, criada_agora)."""
    existing = db.query(SLARule).filter(SLARule.priority == priority).first()
    if existing:
        return existing.resolution_time_hours, False
    rule = SLARule(priority=priority, response_time_hours=1, resolution_time_hours=resolution_hours)
    db.add(rule)
    db.commit()
    return resolution_hours, True


def run():
    db = SessionLocal()
    requester = User(
        name="Usuário SLA Teste", email="teste.sla.requester@example.com",
        role="end_user", password_hash="x",
    )
    manager = User(
        name="Gestor SLA Teste", email="teste.sla.manager@example.com",
        role="manager", password_hash="x",
    )
    technician = User(
        name="Técnico SLA Teste", email="teste.sla.technician@example.com",
        role="technician", password_hash="x",
    )
    db.add_all([requester, manager, technician])
    db.commit()
    db.refresh(requester)
    db.refresh(manager)
    db.refresh(technician)
    print(f"[setup] requester={requester.id} manager={manager.id} technician={technician.id}")

    auth_headers = {"Authorization": f"Bearer {create_access_token(requester)}"}
    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}
    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}

    high_hours, high_created_rule = _ensure_rule(db, "high", 8)
    low_hours, low_created_rule = _ensure_rule(db, "low", 72)
    print(f"[setup] sla_rules: high={high_hours}h low={low_hours}h")

    windows, holidays = _load_calendar(db)
    assert windows, "seed_dev_data.py precisa ter rodado (business_hours vazia -> sla_due_at sempre None)"

    created_ids = []
    try:
        # --- baseline do dashboard (antes de criar o chamado estourado) ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        before = resp.json()

        # --- POST /tickets com priority=high -> sla_due_at ~= agora + high_hours ---
        before_create = datetime.now(timezone.utc)
        resp = client.post(
            "/tickets",
            json={
                "title": "Chamado SLA teste",
                "description": "valida calculo de sla_due_at na criacao",
                "requester_id": str(requester.id),
                "priority": "high",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        ticket_id = body["id"]
        created_ids.append(ticket_id)
        assert body["sla_due_at"] is not None, "priority reconhecida em sla_rules deveria gerar sla_due_at"
        due_at = datetime.fromisoformat(body["sla_due_at"])
        expected = add_business_hours(before_create, high_hours, windows, holidays)
        assert abs(due_at - expected) < TOLERANCE, f"due_at={due_at} esperado~={expected}"
        print(f"[OK] POST /tickets priority=high -> sla_due_at ~= criação + {high_hours}h em horário comercial")

        # --- PATCH priority=low -> recalcula a partir da CRIAÇÃO, não do PATCH ---
        resp = client.get(f"/tickets/{ticket_id}", headers=auth_headers)
        created_at = datetime.fromisoformat(resp.json()["created_at"])

        # PATCH exige role=technician (achado durante a Fase 13, corrigido no
        # backend) — checa o guard antes de checar o cálculo em si.
        resp = client.patch(f"/tickets/{ticket_id}", json={"priority": "low"}, headers=auth_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] PATCH /tickets/{id} com usuário final -> 403")

        resp = client.patch(f"/tickets/{ticket_id}", json={"priority": "low"}, headers=tech_headers)
        assert resp.status_code == 200, resp.text
        updated = resp.json()
        new_due_at = datetime.fromisoformat(updated["sla_due_at"])
        expected_new = add_business_hours(created_at, low_hours, windows, holidays)
        assert abs(new_due_at - expected_new) < TOLERANCE, f"due_at={new_due_at} esperado~={expected_new}"
        assert new_due_at != due_at
        print(f"[OK] PATCH priority=low -> sla_due_at recalculado a partir da criação (+{low_hours}h em horário comercial), não do PATCH")

        # --- chamado com SLA já estourado (created_at forçado no passado direto no banco) ---
        breached = Ticket(
            title="Chamado SLA estourado teste",
            description="ja deveria estar resolvido ha muito tempo",
            priority="critical",
            status="open",
            requester_id=requester.id,
            created_at=datetime.now(timezone.utc) - timedelta(days=30),
        )
        db.add(breached)
        db.flush()
        breached.sla_due_at = datetime.now(timezone.utc) - timedelta(days=29)
        db.commit()
        created_ids.append(breached.id)
        print(f"[setup] chamado estourado criado={breached.id}")

        # --- dashboard reflete o estouro ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        after = resp.json()
        assert after["sla"]["tracked_total"] == before["sla"]["tracked_total"] + 2
        assert after["sla"]["breached"] == before["sla"]["breached"] + 1
        print("[OK] GET /dashboard/summary.sla -> tracked_total +2, breached +1")

        print("\nTODOS OS TESTES DA FASE 4 (SLA) PASSARAM")
    finally:
        if created_ids:
            db.query(Ticket).filter(Ticket.id.in_(created_ids)).delete(synchronize_session=False)
        if high_created_rule:
            db.query(SLARule).filter(SLARule.priority == "high").delete()
        if low_created_rule:
            db.query(SLARule).filter(SLARule.priority == "low").delete()
        db.query(User).filter(User.id.in_([requester.id, manager.id, technician.id])).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
