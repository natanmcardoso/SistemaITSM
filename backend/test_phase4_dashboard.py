"""
Teste da Fase 4 (tela 3/3): dashboard do gestor + guard de autenticação em /tickets.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). Valida:
- GET /dashboard/summary sem token -> 401; com token de não-gestor -> 403;
  com token de gestor -> 200.
- GET/POST /tickets sem token -> 401 (guard que faltava desde a Fase 4.0,
  plugado agora — ver CLAUDE.md).
- Métricas do dashboard batem com o esperado.

O dashboard agrega a tabela inteira (não é escopado por teste), e o banco é
compartilhado com o seed de dev — por isso as asserções comparam o "antes" e
o "depois" (delta), como os outros testes fazem, em vez de valores
absolutos. Categorias usam nomes únicos por execução (timestamp) para não
colidir com "Hardware"/"Software" do seed.
"""
import time

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Category, Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    suffix = str(int(time.time()))
    requester = User(
        name="Usuário Dashboard Teste", email=f"teste.dash.requester.{suffix}@example.com",
        role="end_user", password_hash="x",
    )
    technician = User(
        name="Técnico Dashboard Teste", email=f"teste.dash.technician.{suffix}@example.com",
        role="technician", password_hash="x",
    )
    manager = User(
        name="Gestor Dashboard Teste", email=f"teste.dash.manager.{suffix}@example.com",
        role="manager", password_hash="x",
    )
    cat_hw = Category(name=f"Hardware Teste {suffix}", default_sla_hours=24)
    cat_sw = Category(name=f"Software Teste {suffix}", default_sla_hours=16)
    db.add_all([requester, technician, manager, cat_hw, cat_sw])
    db.commit()
    for obj in (requester, technician, manager, cat_hw, cat_sw):
        db.refresh(obj)
    print(f"[setup] requester={requester.id} technician={technician.id} manager={manager.id}")

    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}
    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}

    created_ids = []
    try:
        # --- guard: /tickets sem token -> 401 ---
        resp = client.get("/tickets")
        assert resp.status_code == 401, resp.text
        print("[OK] GET /tickets sem token -> 401")

        # --- guard: /dashboard/summary sem token -> 401 ---
        resp = client.get("/dashboard/summary")
        assert resp.status_code == 401, resp.text
        print("[OK] GET /dashboard/summary sem token -> 401")

        # --- guard: /dashboard/summary com token de técnico (não-gestor) -> 403 ---
        resp = client.get("/dashboard/summary", headers=tech_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /dashboard/summary com token de técnico -> 403")

        # --- baseline (antes de criar os chamados de teste) ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        before = resp.json()
        print("[OK] GET /dashboard/summary com token de gestor -> 200 (baseline capturada)")

        # --- 3 chamados: prioridade/categoria explícitas (sem IA envolvida) ---
        # Ticket 1: mantido (sugestão == final) em priority e category
        # Ticket 2: reclassificado (sugestão != final) em priority e category
        # Ticket 3: sem sugestão da IA (não conta pra accuracy), status diferente
        specs = [
            dict(title="Dash 1", priority="high", ai_suggested_priority="high",
                 category_id=cat_hw.id, ai_suggested_category_id=cat_hw.id, status="open"),
            dict(title="Dash 2", priority="low", ai_suggested_priority="medium",
                 category_id=cat_hw.id, ai_suggested_category_id=cat_sw.id, status="resolved"),
            dict(title="Dash 3", priority="critical", ai_suggested_priority=None,
                 category_id=cat_sw.id, ai_suggested_category_id=None, status="in_progress"),
        ]
        for spec in specs:
            ticket = Ticket(
                description="chamado de teste do dashboard",
                requester_id=requester.id,
                **spec,
            )
            db.add(ticket)
            db.flush()
            created_ids.append(ticket.id)
        db.commit()
        print(f"[setup] {len(created_ids)} chamados de teste criados")

        # --- depois: valida deltas ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        after = resp.json()

        assert after["total_tickets"] == before["total_tickets"] + 3
        print("[OK] total_tickets += 3")

        for status, delta in {"open": 1, "resolved": 1, "in_progress": 1}.items():
            assert after["by_status"][status] == before["by_status"].get(status, 0) + delta, status
        print("[OK] by_status reflete os 3 chamados (open/resolved/in_progress +1 cada)")

        top_by_name = {c["name"]: c["count"] for c in after["top_categories"]}
        assert top_by_name[cat_hw.name] == 2, top_by_name
        assert top_by_name[cat_sw.name] == 1, top_by_name
        print("[OK] top_categories -> Hardware Teste=2, Software Teste=1")

        prio_delta_suggested = after["ai_accuracy_priority"]["suggested_total"] - before["ai_accuracy_priority"]["suggested_total"]
        prio_delta_matched = after["ai_accuracy_priority"]["matched"] - before["ai_accuracy_priority"]["matched"]
        assert prio_delta_suggested == 2, "só Dash 1 e Dash 2 têm ai_suggested_priority"
        assert prio_delta_matched == 1, "só Dash 1 manteve a sugestão de priority"
        print("[OK] ai_accuracy_priority -> +2 sugeridos, +1 mantido (Dash 3 fica de fora, sem sugestão)")

        cat_delta_suggested = after["ai_accuracy_category"]["suggested_total"] - before["ai_accuracy_category"]["suggested_total"]
        cat_delta_matched = after["ai_accuracy_category"]["matched"] - before["ai_accuracy_category"]["matched"]
        assert cat_delta_suggested == 2, "só Dash 1 e Dash 2 têm ai_suggested_category_id"
        assert cat_delta_matched == 1, "só Dash 1 manteve a sugestão de categoria"
        print("[OK] ai_accuracy_category -> +2 sugeridos, +1 mantido (Dash 3 fica de fora, sem sugestão)")

        print("\nTODOS OS TESTES DA FASE 4 (DASHBOARD) PASSARAM")
    finally:
        if created_ids:
            db.query(Ticket).filter(Ticket.id.in_(created_ids)).delete(synchronize_session=False)
        db.query(Category).filter(Category.id.in_([cat_hw.id, cat_sw.id])).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_([requester.id, technician.id, manager.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
