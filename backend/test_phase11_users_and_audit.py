"""
Teste da Fase 11, sub-fase 11.2: administração de usuários + trilha de
auditoria — GET/POST /users, PATCH /users/{id} e GET /audit-log, todos
restritos a role=admin.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import AuditLog, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    admin = User(
        name="Admin Teste Fase 11", email="teste.fase11.admin.users@example.com",
        role="admin", password_hash="x",
    )
    technician = User(
        name="Técnico Teste Fase 11", email="teste.fase11.tech.users@example.com",
        role="technician", password_hash="x",
    )
    db.add_all([admin, technician])
    db.commit()
    for u in (admin, technician):
        db.refresh(u)

    admin_headers = {"Authorization": f"Bearer {create_access_token(admin)}"}
    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}

    created_user_id = None
    try:
        # --- guard: não-admin não pode listar/criar/ver auditoria ---
        resp = client.get("/users", headers=tech_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /users com técnico -> 403")

        resp = client.post(
            "/users",
            json={
                "name": "Tentativa indevida", "email": "tentativa.indevida@example.com",
                "role": "technician", "password": "senha123",
            },
            headers=tech_headers,
        )
        assert resp.status_code == 403, resp.text
        print("[OK] POST /users com técnico -> 403")

        resp = client.get("/audit-log", headers=tech_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /audit-log com técnico -> 403")

        # --- admin cria usuário ---
        resp = client.post(
            "/users",
            json={
                "name": "Usuário Criado Fase 11", "email": "teste.fase11.criado@example.com",
                "role": "end_user", "password": "senha123",
            },
            headers=admin_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        created_user_id = body["id"]
        assert body["name"] == "Usuário Criado Fase 11"
        assert body["role"] == "end_user"
        assert "password" not in body and "password_hash" not in body
        print(f"[OK] POST /users com admin -> 201, user={created_user_id}, senha não vaza na resposta")

        # --- e-mail duplicado é barrado ---
        resp = client.post(
            "/users",
            json={
                "name": "Duplicado", "email": "teste.fase11.criado@example.com",
                "role": "end_user", "password": "senha123",
            },
            headers=admin_headers,
        )
        assert resp.status_code == 400, resp.text
        print("[OK] POST /users com e-mail duplicado -> 400")

        # --- admin lista e encontra o usuário criado ---
        resp = client.get("/users", headers=admin_headers)
        assert resp.status_code == 200, resp.text
        assert created_user_id in [u["id"] for u in resp.json()]
        print("[OK] GET /users com admin -> 200, encontra o usuário criado")

        # --- admin promove o usuário criado a técnico (PATCH parcial: só role) ---
        resp = client.patch(f"/users/{created_user_id}", json={"role": "technician"}, headers=admin_headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["role"] == "technician"
        assert body["name"] == "Usuário Criado Fase 11", "nome não deveria mudar (PATCH parcial)"
        print("[OK] PATCH /users/{id} com admin -> 200, atualiza só o campo enviado")

        # --- editar usuário inexistente -> 404 ---
        resp = client.patch(
            "/users/00000000-0000-0000-0000-000000000000", json={"role": "manager"}, headers=admin_headers
        )
        assert resp.status_code == 404, resp.text
        print("[OK] PATCH /users/{id} inexistente -> 404")

        # --- as duas ações geraram entrada em audit_log ---
        resp = client.get("/audit-log", headers=admin_headers)
        assert resp.status_code == 200, resp.text
        entries = resp.json()
        create_entries = [
            e for e in entries
            if e["action"] == "create_user" and e["entity_id"] == created_user_id and e["user_id"] == str(admin.id)
        ]
        update_entries = [
            e for e in entries
            if e["action"] == "update_user" and e["entity_id"] == created_user_id and e["user_id"] == str(admin.id)
        ]
        assert len(create_entries) == 1, "deveria ter exatamente 1 entrada create_user pra esse usuário"
        assert len(update_entries) == 1, "deveria ter exatamente 1 entrada update_user pra esse usuário"
        print("[OK] GET /audit-log com admin -> 200, contém create_user e update_user do usuário criado")

        print("\nTODOS OS TESTES DA FASE 11 (USUÁRIOS + AUDITORIA) PASSARAM")
    finally:
        if created_user_id:
            db.query(AuditLog).filter(AuditLog.entity_id == created_user_id).delete()
            db.query(User).filter(User.id == created_user_id).delete()
        db.query(AuditLog).filter(AuditLog.user_id.in_([admin.id, technician.id])).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_([admin.id, technician.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
