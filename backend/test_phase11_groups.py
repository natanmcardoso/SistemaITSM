"""
Teste da Fase 11, sub-fase 11.3: administração de grupos —
GET/POST /groups, PATCH /groups/{id}/members, restritos a role=admin.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import AuditLog, Group, User, UserGroup
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    admin = User(
        name="Admin Teste Fase 11 Grupos", email="teste.fase11.admin.groups@example.com",
        role="admin", password_hash="x",
    )
    technician = User(
        name="Técnico Teste Fase 11 Grupos", email="teste.fase11.tech.groups@example.com",
        role="technician", password_hash="x",
    )
    member_one = User(
        name="Membro Um Teste Fase 11", email="teste.fase11.membro1@example.com",
        role="technician", password_hash="x",
    )
    member_two = User(
        name="Membro Dois Teste Fase 11", email="teste.fase11.membro2@example.com",
        role="technician", password_hash="x",
    )
    db.add_all([admin, technician, member_one, member_two])
    db.commit()
    for u in (admin, technician, member_one, member_two):
        db.refresh(u)

    admin_headers = {"Authorization": f"Bearer {create_access_token(admin)}"}
    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}

    group_id = None
    try:
        # --- guard: não-admin não pode listar/criar/editar membros ---
        resp = client.get("/groups", headers=tech_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /groups com técnico -> 403")

        resp = client.post("/groups", json={"name": "Tentativa indevida"}, headers=tech_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] POST /groups com técnico -> 403")

        # --- admin cria grupo (sem membros ainda) ---
        resp = client.post(
            "/groups",
            json={"name": "Equipe de Redes Teste Fase 11", "description": "Grupo de teste"},
            headers=admin_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        group_id = body["id"]
        assert body["name"] == "Equipe de Redes Teste Fase 11"
        assert body["member_ids"] == []
        print(f"[OK] POST /groups com admin -> 201, group={group_id}, sem membros")

        # --- guard: não-admin não pode editar membros ---
        resp = client.patch(
            f"/groups/{group_id}/members", json={"member_ids": [str(member_one.id)]}, headers=tech_headers
        )
        assert resp.status_code == 403, resp.text
        print("[OK] PATCH /groups/{id}/members com técnico -> 403")

        # --- admin lista e encontra o grupo criado ---
        resp = client.get("/groups", headers=admin_headers)
        assert resp.status_code == 200, resp.text
        assert group_id in [g["id"] for g in resp.json()]
        print("[OK] GET /groups com admin -> 200, encontra o grupo criado")

        # --- admin adiciona 2 membros ---
        resp = client.patch(
            f"/groups/{group_id}/members",
            json={"member_ids": [str(member_one.id), str(member_two.id)]},
            headers=admin_headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert set(body["member_ids"]) == {str(member_one.id), str(member_two.id)}
        print("[OK] PATCH /groups/{id}/members -> 200, 2 membros adicionados")

        # --- admin substitui pela lista com só 1 membro (remove o outro) ---
        resp = client.patch(
            f"/groups/{group_id}/members", json={"member_ids": [str(member_one.id)]}, headers=admin_headers
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["member_ids"] == [str(member_one.id)]
        print("[OK] PATCH /groups/{id}/members -> 200, substituição remove o membro que saiu da lista")

        # --- usuário inexistente na lista de membros -> 400 ---
        resp = client.patch(
            f"/groups/{group_id}/members",
            json={"member_ids": ["00000000-0000-0000-0000-000000000000"]},
            headers=admin_headers,
        )
        assert resp.status_code == 400, resp.text
        print("[OK] PATCH /groups/{id}/members com usuário inexistente -> 400")

        # --- grupo inexistente -> 404 ---
        resp = client.patch(
            "/groups/00000000-0000-0000-0000-000000000000/members",
            json={"member_ids": []},
            headers=admin_headers,
        )
        assert resp.status_code == 404, resp.text
        print("[OK] PATCH /groups/{id}/members com grupo inexistente -> 404")

        # --- create_group e update_group_members geraram entrada em audit_log ---
        resp = client.get("/audit-log", headers=admin_headers)
        assert resp.status_code == 200, resp.text
        entries = resp.json()
        create_entries = [e for e in entries if e["action"] == "create_group" and e["entity_id"] == group_id]
        update_entries = [
            e for e in entries if e["action"] == "update_group_members" and e["entity_id"] == group_id
        ]
        assert len(create_entries) == 1
        assert len(update_entries) == 2, "os 2 PATCHes bem-sucedidos (400/404 não geram log) deveriam ter gerado 2 entradas"
        print("[OK] GET /audit-log -> contém create_group e as 2 update_group_members bem-sucedidas do grupo criado")

        print("\nTODOS OS TESTES DA FASE 11 (GRUPOS) PASSARAM")
    finally:
        if group_id:
            db.query(AuditLog).filter(AuditLog.entity_id == group_id).delete()
            db.query(UserGroup).filter(UserGroup.group_id == group_id).delete()
            db.query(Group).filter(Group.id == group_id).delete()
        db.query(AuditLog).filter(AuditLog.user_id == admin.id).delete(synchronize_session=False)
        db.query(User).filter(
            User.id.in_([admin.id, technician.id, member_one.id, member_two.id])
        ).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
