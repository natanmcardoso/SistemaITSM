"""
Teste da Fase 5 (Navegação e Descoberta), sub-fase 5.1 (backend):
filtro `category_id` e busca por texto (`query`) em GET /tickets.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). Valida:
- category_id devolve só os chamados daquela categoria;
- query casa por substring case-insensitive em título OU descrição;
- os dois combinados (AND).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Category, Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    requester = User(
        name="Usuário Fase5 Filtros", email="teste.fase5.filtros@example.com",
        role="end_user", password_hash="x",
    )
    db.add(requester)
    db.commit()
    db.refresh(requester)

    category = db.query(Category).filter(Category.name == "Rede").first()
    created_category = False
    if category is None:
        category = Category(name="Rede")
        db.add(category)
        db.commit()
        db.refresh(category)
        created_category = True

    ticket_match = Ticket(
        title="Impressora não liga", description="Impressora do 3º andar não responde",
        status="open", requester_id=requester.id, category_id=category.id,
    )
    ticket_other_category = Ticket(
        title="VPN caindo", description="Impressora citada só de raspão",
        status="open", requester_id=requester.id,
    )
    ticket_no_text_match = Ticket(
        title="Monitor com defeito", description="Tela piscando",
        status="open", requester_id=requester.id, category_id=category.id,
    )
    db.add_all([ticket_match, ticket_other_category, ticket_no_text_match])
    db.commit()
    for t in (ticket_match, ticket_other_category, ticket_no_text_match):
        db.refresh(t)
    print(f"[setup] category={category.id} tickets={ticket_match.id},{ticket_other_category.id},{ticket_no_text_match.id}")

    headers = {"Authorization": f"Bearer {create_access_token(requester)}"}

    try:
        resp = client.get("/tickets", params={"category_id": str(category.id)}, headers=headers)
        assert resp.status_code == 200, resp.text
        ids = [t["id"] for t in resp.json()]
        assert str(ticket_match.id) in ids
        assert str(ticket_no_text_match.id) in ids
        assert str(ticket_other_category.id) not in ids
        print("[OK] GET /tickets?category_id= devolve só os chamados daquela categoria")

        resp = client.get("/tickets", params={"query": "impressora"}, headers=headers)
        assert resp.status_code == 200, resp.text
        ids = [t["id"] for t in resp.json()]
        assert str(ticket_match.id) in ids
        assert str(ticket_other_category.id) in ids
        assert str(ticket_no_text_match.id) not in ids
        print("[OK] GET /tickets?query= casa por substring case-insensitive em título OU descrição")

        resp = client.get(
            "/tickets", params={"category_id": str(category.id), "query": "impressora"}, headers=headers
        )
        assert resp.status_code == 200, resp.text
        ids = [t["id"] for t in resp.json()]
        assert ids == [str(ticket_match.id)]
        print("[OK] category_id + query combinados (AND) devolvem só a interseção")

        print("\nTODOS OS TESTES DA FASE 5 (FILTROS DE TICKETS) PASSARAM")
    finally:
        db.query(Ticket).filter(
            Ticket.id.in_([ticket_match.id, ticket_other_category.id, ticket_no_text_match.id])
        ).delete(synchronize_session=False)
        db.query(User).filter(User.id == requester.id).delete(synchronize_session=False)
        if created_category:
            db.query(Category).filter(Category.id == category.id).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
