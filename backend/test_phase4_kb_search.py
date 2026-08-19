"""
Teste da Fase 4 (sub-fase busca de KB pelo técnico): filtro `query` em
GET /kb-articles — substring case-insensitive em título OU conteúdo,
combinável com `category_id`.

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
        name="Técnico KB Search Teste", email="teste.kbsearch.technician@example.com",
        role="technician", password_hash="x",
    )
    category = Category(name="Categoria KB Search Teste", default_sla_hours=8)
    db.add_all([technician, category])
    db.commit()
    db.refresh(technician)
    db.refresh(category)

    article = KBArticle(
        title="Como resetar a senha de rede",
        content="Passo a passo para resetar a senha de acesso à rede corporativa.",
        category_id=category.id,
    )
    other_article = KBArticle(
        title="Impressora sem toner", content="Troque o cartucho de toner.", category_id=category.id,
    )
    db.add_all([article, other_article])
    db.commit()
    db.refresh(article)
    db.refresh(other_article)
    print(f"[setup] technician={technician.id} category={category.id} article={article.id}")

    headers = {"Authorization": f"Bearer {create_access_token(technician)}"}

    try:
        # --- busca por termo no título (case-insensitive) ---
        resp = client.get("/kb-articles", params={"query": "SENHA"}, headers=headers)
        assert resp.status_code == 200, resp.text
        ids = [a["id"] for a in resp.json()]
        assert str(article.id) in ids
        assert str(other_article.id) not in ids
        print("[OK] GET /kb-articles?query= casa por título, case-insensitive")

        # --- busca por termo no conteúdo ---
        resp = client.get("/kb-articles", params={"query": "toner"}, headers=headers)
        assert resp.status_code == 200, resp.text
        ids = [a["id"] for a in resp.json()]
        assert str(other_article.id) in ids
        assert str(article.id) not in ids
        print("[OK] GET /kb-articles?query= casa por conteúdo")

        # --- combinável com category_id ---
        resp = client.get(
            "/kb-articles", params={"query": "senha", "category_id": str(category.id)}, headers=headers,
        )
        assert resp.status_code == 200, resp.text
        ids = [a["id"] for a in resp.json()]
        assert str(article.id) in ids
        print("[OK] GET /kb-articles?query=&category_id= combina os dois filtros")

        # --- sem match ---
        resp = client.get("/kb-articles", params={"query": "termo-que-nao-existe-em-nada"}, headers=headers)
        assert resp.status_code == 200, resp.text
        assert all(a["id"] not in (str(article.id), str(other_article.id)) for a in resp.json())
        print("[OK] GET /kb-articles?query= sem match -> não devolve os artigos de teste")

        print("\nTODOS OS TESTES DA FASE 4 (KB SEARCH) PASSARAM")
    finally:
        db.query(KBArticle).filter(KBArticle.id.in_([article.id, other_article.id])).delete(synchronize_session=False)
        db.query(Category).filter(Category.id == category.id).delete()
        db.query(User).filter(User.id == technician.id).delete()
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
