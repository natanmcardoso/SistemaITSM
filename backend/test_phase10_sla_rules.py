"""
Teste da Fase 10, sub-fase 10.2: edição de regras de SLA —
GET/PATCH /sla-rules, restrito a role=technician/manager.

Sem POST (as 4 prioridades já são fixas no enum, `SLARule.priority` é
única) — reusa a regra já semeada por seed_dev_data.py (mesmo padrão de
test_phase4_sla.py) e restaura o valor original no finally, em vez de criar
uma regra própria e apagar.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import SLARule, User
from app.security import create_access_token

client = TestClient(app)


def _ensure_rule(db, priority: str, response_hours: int, resolution_hours: int):
    """Garante uma sla_rule pra essa priority; devolve (regra, criada_agora)."""
    existing = db.query(SLARule).filter(SLARule.priority == priority).first()
    if existing:
        return existing, False
    rule = SLARule(priority=priority, response_time_hours=response_hours, resolution_time_hours=resolution_hours)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule, True


def run():
    db = SessionLocal()
    technician = User(
        name="Técnico SLA Rules Teste", email="teste.fase10.slatech@example.com",
        role="technician", password_hash="x",
    )
    manager = User(
        name="Gestor SLA Rules Teste", email="teste.fase10.slamanager@example.com",
        role="manager", password_hash="x",
    )
    end_user = User(
        name="Usuário SLA Rules Teste", email="teste.fase10.slaenduser@example.com",
        role="end_user", password_hash="x",
    )
    db.add_all([technician, manager, end_user])
    db.commit()
    for u in (technician, manager, end_user):
        db.refresh(u)

    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}
    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}
    user_headers = {"Authorization": f"Bearer {create_access_token(end_user)}"}

    rule, created_rule = _ensure_rule(db, "low", response_hours=4, resolution_hours=72)
    original_response_hours = rule.response_time_hours
    original_resolution_hours = rule.resolution_time_hours
    print(f"[setup] sla_rule low: response={original_response_hours}h resolution={original_resolution_hours}h")

    try:
        # --- guard: usuário final não pode listar/editar ---
        resp = client.get("/sla-rules", headers=user_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /sla-rules com usuário final -> 403")

        resp = client.patch(f"/sla-rules/{rule.id}", json={"response_time_hours": 1}, headers=user_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] PATCH /sla-rules/{id} com usuário final -> 403")

        # --- técnico lista e encontra a regra ---
        resp = client.get("/sla-rules", headers=tech_headers)
        assert resp.status_code == 200, resp.text
        rules = resp.json()
        assert str(rule.id) in [r["id"] for r in rules]
        assert len(rules) <= 4, "só existem 4 prioridades possíveis no enum"
        print(f"[OK] GET /sla-rules com técnico -> 200, {len(rules)} regra(s), encontra a de priority=low")

        # --- gestor edita (PATCH parcial: só resolution_time_hours) ---
        resp = client.patch(
            f"/sla-rules/{rule.id}", json={"resolution_time_hours": 96}, headers=manager_headers
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["resolution_time_hours"] == 96
        assert body["response_time_hours"] == original_response_hours, "response_time_hours não deveria mudar"
        assert body["priority"] == "low"
        print("[OK] PATCH /sla-rules/{id} com gestor -> 200, atualiza só o campo enviado, priority intocada")

        # --- editar regra inexistente -> 404 ---
        resp = client.patch(
            "/sla-rules/00000000-0000-0000-0000-000000000000",
            json={"resolution_time_hours": 1},
            headers=tech_headers,
        )
        assert resp.status_code == 404, resp.text
        print("[OK] PATCH /sla-rules/{id} inexistente -> 404")

        print("\nTODOS OS TESTES DA FASE 10 (EDIÇÃO DE REGRAS DE SLA) PASSARAM")
    finally:
        if created_rule:
            db.query(SLARule).filter(SLARule.id == rule.id).delete()
        else:
            db.query(SLARule).filter(SLARule.id == rule.id).update(
                {
                    "response_time_hours": original_response_hours,
                    "resolution_time_hours": original_resolution_hours,
                }
            )
        db.query(User).filter(User.id.in_([technician.id, manager.id, end_user.id])).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()
        print("[OK] limpeza: regra restaurada / removida, dados de teste removidos")


if __name__ == "__main__":
    run()
