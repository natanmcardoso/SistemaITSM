"""
Teste da Fase 2: endpoints core de tickets (CRUD), sem IA ainda.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon) e valida:
criar chamado, listar (com filtro), buscar detalhe, atualizar via API.
Usuário/categoria de apoio são criados direto no banco (não há endpoints
de users/categories nesta fase) e tudo é limpo ao final.
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Category, Ticket, User

client = TestClient(app)


def run():
    db = SessionLocal()
    requester = User(name="Usuário API Teste", email="teste.api.requester@example.com", role="end_user")
    technician = User(name="Técnico API Teste", email="teste.api.technician@example.com", role="technician")
    category = Category(name="Hardware", default_sla_hours=24)
    db.add_all([requester, technician, category])
    db.commit()
    db.refresh(requester)
    db.refresh(technician)
    db.refresh(category)
    print(f"[setup] requester={requester.id} technician={technician.id} category={category.id}")

    created_ticket_id = None
    try:
        # --- GET /health ---
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
        print("[OK] GET /health")

        # --- POST /tickets ---
        resp = client.post(
            "/tickets",
            json={
                "title": "Notebook não liga",
                "description": "Notebook do financeiro não liga desde ontem.",
                "requester_id": str(requester.id),
                "category_id": str(category.id),
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        created_ticket_id = body["id"]
        assert body["status"] == "open"
        assert body["priority"] is None
        assert body["resolved_by_ai"] is False
        print(f"[OK] POST /tickets -> ticket criado {created_ticket_id}")

        # --- validação: requester_id inexistente deve dar 400 ---
        resp = client.post(
            "/tickets",
            json={
                "title": "x",
                "description": "y",
                "requester_id": "00000000-0000-0000-0000-000000000000",
            },
        )
        assert resp.status_code == 400, resp.text
        print("[OK] POST /tickets com requester_id inválido -> 400")

        # --- GET /tickets (lista) ---
        resp = client.get("/tickets", params={"status": "open"})
        assert resp.status_code == 200
        ids = [t["id"] for t in resp.json()]
        assert created_ticket_id in ids
        print(f"[OK] GET /tickets?status=open -> {len(ids)} ticket(s), inclui o criado")

        # --- GET /tickets/{id} (detalhe) ---
        resp = client.get(f"/tickets/{created_ticket_id}")
        assert resp.status_code == 200
        detail = resp.json()
        assert detail["title"] == "Notebook não liga"
        assert detail["interactions"] == []
        print("[OK] GET /tickets/{id} -> detalhe com interactions=[]")

        # --- GET /tickets/{id} inexistente -> 404 ---
        resp = client.get("/tickets/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404
        print("[OK] GET /tickets/{id} inexistente -> 404")

        # --- PATCH /tickets/{id} ---
        resp = client.patch(
            f"/tickets/{created_ticket_id}",
            json={"status": "in_progress", "priority": "high", "assignee_id": str(technician.id)},
        )
        assert resp.status_code == 200, resp.text
        updated = resp.json()
        assert updated["status"] == "in_progress"
        assert updated["priority"] == "high"
        assert updated["assignee_id"] == str(technician.id)
        print("[OK] PATCH /tickets/{id} -> status/priority/assignee atualizados")

        # --- GET /tickets com filtro por assignee_id reflete o PATCH ---
        resp = client.get("/tickets", params={"assignee_id": str(technician.id)})
        assert resp.status_code == 200
        assert any(t["id"] == created_ticket_id for t in resp.json())
        print("[OK] GET /tickets?assignee_id=... reflete a atualização")

        print("\nTODOS OS TESTES DA FASE 2 PASSARAM")
    finally:
        if created_ticket_id:
            db.query(Ticket).filter(Ticket.id == created_ticket_id).delete()
        db.query(Category).filter(Category.id == category.id).delete()
        db.query(User).filter(User.id.in_([requester.id, technician.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
