"""
Teste da Fase 8, sub-fase 8.4: CRUD de artigos da base de conhecimento —
POST /kb-articles (criar) e PATCH /kb-articles/{id} (editar), restritos a
role=technician. Sem exclusão (fora do pedido que originou esta sub-fase).

Sobe a app FastAPI real (TestClient) contra o banco real (Neon).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Category, KBArticle, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    technician = User(
        name="Técnico KB Teste", email="teste.fase8.kbtech@example.com",
        role="technician", password_hash="x",
    )
    end_user = User(
        name="Usuário KB Teste", email="teste.fase8.kbenduser@example.com",
        role="end_user", password_hash="x",
    )
    db.add_all([technician, end_user])
    db.commit()
    for u in (technician, end_user):
        db.refresh(u)

    category = db.query(Category).filter(Category.name == "Software").first()
    created_category = False
    if category is None:
        category = Category(name="Software", default_sla_hours=16)
        db.add(category)
        db.commit()
        db.refresh(category)
        created_category = True

    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}
    user_headers = {"Authorization": f"Bearer {create_access_token(end_user)}"}

    article_id = None
    try:
        # --- guard: usuário final não pode criar ---
        resp = client.post(
            "/kb-articles",
            json={"title": "Tentativa indevida", "content": "não deveria criar"},
            headers=user_headers,
        )
        assert resp.status_code == 403, resp.text
        print("[OK] POST /kb-articles com usuário final -> 403")

        # --- técnico cria ---
        resp = client.post(
            "/kb-articles",
            json={
                "title": "Artigo de teste da Fase 8",
                "content": "Conteúdo original do artigo de teste.",
                "category_id": str(category.id),
            },
            headers=tech_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        article_id = body["id"]
        assert body["title"] == "Artigo de teste da Fase 8"
        assert body["category_id"] == str(category.id)
        print(f"[OK] POST /kb-articles com técnico -> 201, article={article_id}")

        # --- aparece na listagem/busca ---
        resp = client.get("/kb-articles", params={"query": "teste da Fase 8"}, headers=tech_headers)
        assert resp.status_code == 200, resp.text
        assert article_id in [a["id"] for a in resp.json()]
        print("[OK] GET /kb-articles?query= encontra o artigo recém-criado")

        # --- guard: usuário final não pode editar ---
        resp = client.patch(
            f"/kb-articles/{article_id}", json={"title": "Tentativa indevida"}, headers=user_headers
        )
        assert resp.status_code == 403, resp.text
        print("[OK] PATCH /kb-articles/{id} com usuário final -> 403")

        # --- técnico edita (PATCH parcial: só o conteúdo) ---
        resp = client.patch(
            f"/kb-articles/{article_id}",
            json={"content": "Conteúdo atualizado do artigo de teste."},
            headers=tech_headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["content"] == "Conteúdo atualizado do artigo de teste."
        assert body["title"] == "Artigo de teste da Fase 8", "título não deveria mudar (PATCH parcial)"
        print("[OK] PATCH /kb-articles/{id} com técnico -> 200, atualiza só o campo enviado")

        # --- editar artigo inexistente -> 404 ---
        resp = client.patch(
            "/kb-articles/00000000-0000-0000-0000-000000000000", json={"title": "x"}, headers=tech_headers
        )
        assert resp.status_code == 404, resp.text
        print("[OK] PATCH /kb-articles/{id} inexistente -> 404")

        print("\nTODOS OS TESTES DA FASE 8 (CRUD DE KB) PASSARAM")
    finally:
        if article_id:
            db.query(KBArticle).filter(KBArticle.id == article_id).delete()
        if created_category:
            db.query(Category).filter(Category.id == category.id).delete()
        db.query(User).filter(User.id.in_([technician.id, end_user.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
