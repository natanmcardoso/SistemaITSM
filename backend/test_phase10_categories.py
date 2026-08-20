"""
Teste da Fase 10, sub-fase 10.1: CRUD de categorias —
GET/POST/PATCH /categories, restrito a role=technician/manager.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Category, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    technician = User(
        name="Técnico Categorias Teste", email="teste.fase10.categoriastech@example.com",
        role="technician", password_hash="x",
    )
    manager = User(
        name="Gestor Categorias Teste", email="teste.fase10.categoriasmanager@example.com",
        role="manager", password_hash="x",
    )
    end_user = User(
        name="Usuário Categorias Teste", email="teste.fase10.categoriasenduser@example.com",
        role="end_user", password_hash="x",
    )
    db.add_all([technician, manager, end_user])
    db.commit()
    for u in (technician, manager, end_user):
        db.refresh(u)

    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}
    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}
    user_headers = {"Authorization": f"Bearer {create_access_token(end_user)}"}

    category_id = None
    try:
        # --- guard: usuário final não pode listar/criar ---
        resp = client.get("/categories", headers=user_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /categories com usuário final -> 403")

        resp = client.post(
            "/categories", json={"name": "Tentativa indevida", "default_sla_hours": 8}, headers=user_headers
        )
        assert resp.status_code == 403, resp.text
        print("[OK] POST /categories com usuário final -> 403")

        # --- técnico cria ---
        resp = client.post(
            "/categories",
            json={"name": "Categoria de Teste Fase 10", "default_sla_hours": 12},
            headers=tech_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        category_id = body["id"]
        assert body["name"] == "Categoria de Teste Fase 10"
        assert body["default_sla_hours"] == 12
        print(f"[OK] POST /categories com técnico -> 201, category={category_id}")

        # --- duplicata (case-insensitive) é barrada ---
        resp = client.post(
            "/categories",
            json={"name": "categoria de teste fase 10", "default_sla_hours": 4},
            headers=tech_headers,
        )
        assert resp.status_code == 400, resp.text
        print("[OK] POST /categories com nome duplicado (case-insensitive) -> 400")

        # --- gestor lista e encontra ---
        resp = client.get("/categories", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        assert category_id in [c["id"] for c in resp.json()]
        print("[OK] GET /categories com gestor -> 200, encontra a categoria criada")

        # --- gestor edita (PATCH parcial: só o SLA padrão) ---
        resp = client.patch(
            f"/categories/{category_id}", json={"default_sla_hours": 24}, headers=manager_headers
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["default_sla_hours"] == 24
        assert body["name"] == "Categoria de Teste Fase 10", "nome não deveria mudar (PATCH parcial)"
        print("[OK] PATCH /categories/{id} com gestor -> 200, atualiza só o campo enviado")

        # --- editar categoria inexistente -> 404 ---
        resp = client.patch(
            "/categories/00000000-0000-0000-0000-000000000000",
            json={"default_sla_hours": 1},
            headers=tech_headers,
        )
        assert resp.status_code == 404, resp.text
        print("[OK] PATCH /categories/{id} inexistente -> 404")

        print("\nTODOS OS TESTES DA FASE 10 (CRUD DE CATEGORIAS) PASSARAM")
    finally:
        if category_id:
            db.query(Category).filter(Category.id == category_id).delete()
        db.query(User).filter(User.id.in_([technician.id, manager.id, end_user.id])).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
