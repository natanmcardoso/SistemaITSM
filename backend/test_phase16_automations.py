"""
Teste da Fase 16, sub-fase 16.1: backend de Automações — GET/PATCH
/automation-rules e GET /notifications, ambos restritos a role=manager.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon).
`AutomationRule.key` é único e a regra "sla_near_breach" já vem semeada
(seed_dev_data.py) — o teste reusa a regra existente e restaura o valor
original no finally, mesmo padrão de test_phase10_sla_rules.py.
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import AutomationRule, Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    requester = User(
        name="Usuário Automações Teste", email="teste.fase16.requester@example.com",
        role="end_user", password_hash="x",
    )
    manager = User(
        name="Gestor Automações Teste", email="teste.fase16.manager@example.com",
        role="manager", password_hash="x",
    )
    technician = User(
        name="Técnico Automações Teste", email="teste.fase16.technician@example.com",
        role="technician", password_hash="x",
    )
    db.add_all([requester, manager, technician])
    db.commit()
    for u in (requester, manager, technician):
        db.refresh(u)

    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}
    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}

    rule = db.query(AutomationRule).filter(AutomationRule.key == "sla_near_breach").first()
    assert rule is not None, "seed_dev_data.py precisa ter rodado (automation_rules vazia)"
    original = {"threshold_percent": rule.threshold_percent, "enabled": rule.enabled}

    created_ids = []
    try:
        # --- guards ---
        resp = client.get("/automation-rules", headers=tech_headers)
        assert resp.status_code == 403, resp.text
        resp = client.get("/notifications", headers=tech_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /automation-rules e /notifications com técnico -> 403")

        # --- GET /automation-rules ---
        resp = client.get("/automation-rules", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        rules = resp.json()
        assert any(r["key"] == "sla_near_breach" for r in rules)
        print("[OK] GET /automation-rules -> 200, encontra sla_near_breach")

        # --- PATCH: fixa o limiar em 80% pro resto do teste ---
        resp = client.patch(
            f"/automation-rules/{rule.id}", json={"threshold_percent": 80, "enabled": True}, headers=manager_headers
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["threshold_percent"] == 80
        print("[OK] PATCH /automation-rules/{id} -> atualiza threshold_percent")

        # --- PATCH inexistente -> 404 ---
        resp = client.patch(
            "/automation-rules/00000000-0000-0000-0000-000000000000",
            json={"threshold_percent": 50},
            headers=manager_headers,
        )
        assert resp.status_code == 404, resp.text
        print("[OK] PATCH /automation-rules/{id} inexistente -> 404")

        # --- 3 chamados de teste: abaixo do limiar, acima (não estourado), estourado ---
        now = datetime.now(timezone.utc)

        below = Ticket(
            title="T16 abaixo do limiar", description="10% do prazo decorrido",
            status="open", priority="low", requester_id=requester.id,
            created_at=now - timedelta(hours=1), sla_due_at=now + timedelta(hours=9),
        )
        near = Ticket(
            title="T16 perto de estourar", description="80% do prazo decorrido",
            status="open", priority="high", requester_id=requester.id,
            created_at=now - timedelta(hours=8), sla_due_at=now + timedelta(hours=2),
        )
        breached = Ticket(
            title="T16 ja estourado", description="120% do prazo decorrido",
            status="in_progress", priority="critical", requester_id=requester.id,
            created_at=now - timedelta(hours=12), sla_due_at=now - timedelta(hours=2),
        )
        resolved_near = Ticket(
            title="T16 resolvido, nao deveria aparecer", description="90% do prazo, mas ja resolvido",
            status="resolved", priority="high", requester_id=requester.id,
            created_at=now - timedelta(hours=9), sla_due_at=now + timedelta(hours=1),
        )
        for t in (below, near, breached, resolved_near):
            db.add(t)
            db.flush()
            created_ids.append(t.id)
        db.commit()
        print(f"[setup] {len(created_ids)} chamados de teste criados")

        # --- GET /notifications: só near e breached aparecem ---
        resp = client.get("/notifications", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        notif_ids = {n["ticket_id"] for n in resp.json()}
        assert str(near.id) in notif_ids, "chamado a 80% deveria aparecer"
        assert str(breached.id) in notif_ids, "chamado estourado deveria aparecer"
        assert str(below.id) not in notif_ids, "chamado a 10% não deveria aparecer"
        assert str(resolved_near.id) not in notif_ids, "chamado resolvido não deveria aparecer"
        print("[OK] GET /notifications -> inclui perto-de-estourar e estourado, exclui abaixo-do-limiar e resolvido")

        breached_notif = next(n for n in resp.json() if n["ticket_id"] == str(breached.id))
        assert breached_notif["breached"] is True
        near_notif = next(n for n in resp.json() if n["ticket_id"] == str(near.id))
        assert near_notif["breached"] is False
        assert near_notif["elapsed_percent"] >= 80
        print("[OK] GET /notifications -> breached=true só pro já estourado, elapsed_percent >= limiar")

        # --- regra desabilitada -> lista vazia ---
        resp = client.patch(f"/automation-rules/{rule.id}", json={"enabled": False}, headers=manager_headers)
        assert resp.status_code == 200, resp.text
        resp = client.get("/notifications", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        assert resp.json() == []
        print("[OK] regra desabilitada -> GET /notifications devolve lista vazia")

        print("\nTODOS OS TESTES DA FASE 16 (AUTOMAÇÕES — BACKEND) PASSARAM")
    finally:
        if created_ids:
            db.query(Ticket).filter(Ticket.id.in_(created_ids)).delete(synchronize_session=False)
        db.query(AutomationRule).filter(AutomationRule.id == rule.id).update(original)
        db.query(User).filter(User.id.in_([requester.id, manager.id, technician.id])).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()
        print("[OK] limpeza: regra restaurada, dados de teste removidos")


if __name__ == "__main__":
    run()
