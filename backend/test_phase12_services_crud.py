"""
Teste da Fase 12, sub-fase 12.2: endpoints do Catálogo de Serviços —
GET/POST/PATCH /services (GET aberto a qualquer usuário autenticado,
POST/PATCH restritos a technician/manager) + integração com POST /tickets
(service_id herda a categoria quando category_id não vem explícito).

Sobe a app FastAPI real (TestClient) contra o banco real (Neon).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Category, Service, Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    technician = User(
        name="Técnico Serviços Teste", email="teste.fase12.servicostech@example.com",
        role="technician", password_hash="x",
    )
    manager = User(
        name="Gestor Serviços Teste", email="teste.fase12.servicosmanager@example.com",
        role="manager", password_hash="x",
    )
    end_user = User(
        name="Usuário Serviços Teste", email="teste.fase12.servicosenduser@example.com",
        role="end_user", password_hash="x",
    )
    db.add_all([technician, manager, end_user])
    db.commit()
    for u in (technician, manager, end_user):
        db.refresh(u)

    category = Category(name="Categoria Teste Fase 12 CRUD", default_sla_hours=8)
    db.add(category)
    db.commit()
    db.refresh(category)

    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}
    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}
    user_headers = {"Authorization": f"Bearer {create_access_token(end_user)}"}

    service_id = ticket_a_id = ticket_b_id = None
    try:
        # --- guard: usuário final não pode criar ---
        resp = client.post(
            "/services",
            json={"name": "Tentativa indevida", "category_id": str(category.id)},
            headers=user_headers,
        )
        assert resp.status_code == 403, resp.text
        print("[OK] POST /services com usuário final -> 403")

        # --- usuário final PODE listar (catálogo é consumido por ele) ---
        resp = client.get("/services", headers=user_headers)
        assert resp.status_code == 200, resp.text
        print("[OK] GET /services com usuário final -> 200 (catálogo aberto)")

        # --- técnico cria ---
        resp = client.post(
            "/services",
            json={
                "name": "Solicitar novo notebook",
                "category_id": str(category.id),
                "description": "Pedido de notebook novo ou de reposição.",
            },
            headers=tech_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        service_id = body["id"]
        assert body["category_id"] == str(category.id)
        print(f"[OK] POST /services com técnico -> 201, service={service_id}")

        # --- gestor lista e encontra ---
        resp = client.get("/services", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        assert service_id in [s["id"] for s in resp.json()]
        print("[OK] GET /services com gestor -> 200, encontra o serviço criado")

        # --- gestor edita (PATCH parcial: só a descrição) ---
        resp = client.patch(
            f"/services/{service_id}", json={"description": "Descrição atualizada."}, headers=manager_headers
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["description"] == "Descrição atualizada."
        assert body["name"] == "Solicitar novo notebook", "nome não deveria mudar (PATCH parcial)"
        print("[OK] PATCH /services/{id} com gestor -> 200, atualiza só o campo enviado")

        # --- editar serviço inexistente -> 404 ---
        resp = client.patch(
            "/services/00000000-0000-0000-0000-000000000000",
            json={"description": "x"},
            headers=tech_headers,
        )
        assert resp.status_code == 404, resp.text
        print("[OK] PATCH /services/{id} inexistente -> 404")

        # --- POST /tickets com service_id herda a categoria do serviço (sem category_id explícito) ---
        resp = client.post(
            "/tickets",
            json={
                "title": "Preciso de um notebook novo",
                "description": "O meu atual não liga mais.",
                "requester_id": str(end_user.id),
                "service_id": service_id,
            },
            headers=user_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        ticket_a_id = body["id"]
        assert body["service_id"] == service_id
        assert body["category_id"] == str(category.id), "category_id deveria ser herdado do serviço"
        print("[OK] POST /tickets com service_id -> category_id herdado do serviço")

        # --- POST /tickets com service_id + category_id explícito: category_id explícito prevalece ---
        outra_categoria = Category(name="Outra Categoria Teste Fase 12", default_sla_hours=4)
        db.add(outra_categoria)
        db.commit()
        db.refresh(outra_categoria)
        try:
            resp = client.post(
                "/tickets",
                json={
                    "title": "Chamado com categoria explícita e serviço",
                    "description": "category_id explícito deve vencer o do serviço.",
                    "requester_id": str(end_user.id),
                    "service_id": service_id,
                    "category_id": str(outra_categoria.id),
                },
                headers=user_headers,
            )
            assert resp.status_code == 201, resp.text
            body = resp.json()
            ticket_b_id = body["id"]
            assert body["service_id"] == service_id
            assert body["category_id"] == str(outra_categoria.id)
            print("[OK] POST /tickets com service_id + category_id explícito -> category_id explícito prevalece")
        finally:
            if ticket_b_id:
                db.query(Ticket).filter(Ticket.id == ticket_b_id).delete()
                db.commit()
            db.query(Category).filter(Category.id == outra_categoria.id).delete()
            db.commit()

        # --- POST /tickets com service_id inválido -> 400 ---
        resp = client.post(
            "/tickets",
            json={
                "title": "Chamado com service_id inválido",
                "description": "Não deveria criar.",
                "requester_id": str(end_user.id),
                "service_id": "00000000-0000-0000-0000-000000000000",
            },
            headers=user_headers,
        )
        assert resp.status_code == 400, resp.text
        print("[OK] POST /tickets com service_id inexistente -> 400")

        print("\nTODOS OS TESTES DA FASE 12 (ENDPOINTS DO CATÁLOGO DE SERVIÇOS) PASSARAM")
    finally:
        if ticket_a_id:
            db.query(Ticket).filter(Ticket.id == ticket_a_id).delete()
        if service_id:
            db.query(Service).filter(Service.id == service_id).delete()
        db.query(Category).filter(Category.id == category.id).delete()
        db.query(User).filter(User.id.in_([technician.id, manager.id, end_user.id])).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
