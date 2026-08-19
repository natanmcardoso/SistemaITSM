"""
Teste da Fase 4 (sub-fase resolve-by-user): usuário fecha o próprio chamado
a partir da sugestão da IA, e a base de conhecimento mínima que sustenta
essa sugestão (design-itsm-mvp.md §2.1/§5).

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). Valida:
- GET /kb-articles?category_id= filtra corretamente (sem token -> 401).
- POST /tickets/{id}/resolve-by-user: sem token -> 401; por quem não é o
  solicitante -> 403; em chamado que não está "open" -> 400; sucesso ->
  status=resolved, resolved_by_ai=true.
- GET /dashboard/summary.ai_resolution reflete o resolvido (via delta, como
  o resto do dashboard — banco compartilhado com o seed).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Category, KBArticle, Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    requester = User(
        name="Usuário Resolve Teste", email="teste.resolve.requester@example.com",
        role="end_user", password_hash="x",
    )
    other_user = User(
        name="Outro Usuário Resolve Teste", email="teste.resolve.other@example.com",
        role="end_user", password_hash="x",
    )
    manager = User(
        name="Gestor Resolve Teste", email="teste.resolve.manager@example.com",
        role="manager", password_hash="x",
    )
    category = Category(name="Categoria Resolve Teste", default_sla_hours=8)
    db.add_all([requester, other_user, manager, category])
    db.commit()
    for obj in (requester, other_user, manager, category):
        db.refresh(obj)

    article = KBArticle(
        title="Artigo Resolve Teste", content="conteúdo de teste", category_id=category.id,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    print(f"[setup] requester={requester.id} other_user={other_user.id} manager={manager.id} category={category.id} article={article.id}")

    requester_headers = {"Authorization": f"Bearer {create_access_token(requester)}"}
    other_headers = {"Authorization": f"Bearer {create_access_token(other_user)}"}
    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}

    created_ids = []
    try:
        # --- GET /kb-articles sem token -> 401 ---
        resp = client.get("/kb-articles")
        assert resp.status_code == 401, resp.text
        print("[OK] GET /kb-articles sem token -> 401")

        # --- GET /kb-articles?category_id= filtra corretamente ---
        resp = client.get("/kb-articles", params={"category_id": str(category.id)}, headers=requester_headers)
        assert resp.status_code == 200, resp.text
        ids = [a["id"] for a in resp.json()]
        assert str(article.id) in ids
        print("[OK] GET /kb-articles?category_id= inclui o artigo esperado")

        # --- baseline do dashboard ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        before = resp.json()

        # --- cria chamado (fica status=open) ---
        resp = client.post(
            "/tickets",
            json={
                "title": "Chamado resolve-by-user teste",
                "description": "valida fluxo de resolucao pelo usuario",
                "requester_id": str(requester.id),
                "category_id": str(category.id),
                "priority": "low",
            },
            headers=requester_headers,
        )
        assert resp.status_code == 201, resp.text
        ticket_id = resp.json()["id"]
        created_ids.append(ticket_id)
        print(f"[setup] chamado criado={ticket_id}")

        # --- resolve-by-user sem token -> 401 ---
        resp = client.post(f"/tickets/{ticket_id}/resolve-by-user")
        assert resp.status_code == 401, resp.text
        print("[OK] POST /tickets/{id}/resolve-by-user sem token -> 401")

        # --- resolve-by-user por outro usuário (não é o solicitante) -> 403 ---
        resp = client.post(f"/tickets/{ticket_id}/resolve-by-user", headers=other_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] POST /tickets/{id}/resolve-by-user por outro usuário -> 403")

        # --- resolve-by-user pelo solicitante -> 200, status=resolved, resolved_by_ai=true ---
        resp = client.post(f"/tickets/{ticket_id}/resolve-by-user", headers=requester_headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "resolved"
        assert body["resolved_by_ai"] is True
        print("[OK] POST /tickets/{id}/resolve-by-user pelo solicitante -> resolved + resolved_by_ai=true")

        # --- resolve-by-user de novo (já não está mais "open") -> 400 ---
        resp = client.post(f"/tickets/{ticket_id}/resolve-by-user", headers=requester_headers)
        assert resp.status_code == 400, resp.text
        print("[OK] POST /tickets/{id}/resolve-by-user em chamado já resolvido -> 400")

        # --- dashboard reflete o resolvido ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        after = resp.json()
        assert after["ai_resolution"]["total_tickets"] == before["ai_resolution"]["total_tickets"] + 1
        assert after["ai_resolution"]["resolved_by_ai"] == before["ai_resolution"]["resolved_by_ai"] + 1
        print("[OK] GET /dashboard/summary.ai_resolution -> total_tickets +1, resolved_by_ai +1")

        print("\nTODOS OS TESTES DA FASE 4 (RESOLVE-BY-USER) PASSARAM")
    finally:
        if created_ids:
            db.query(Ticket).filter(Ticket.id.in_(created_ids)).delete(synchronize_session=False)
        db.query(KBArticle).filter(KBArticle.id == article.id).delete()
        db.query(Category).filter(Category.id == category.id).delete()
        db.query(User).filter(User.id.in_([requester.id, other_user.id, manager.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
