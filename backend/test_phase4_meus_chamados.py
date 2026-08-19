"""
Teste da Fase 4 (sub-fase acompanhamento do chamado pelo usuário final):
filtro `requester_id` em GET /tickets — base pra tela "Meus chamados".

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). Valida que
o filtro devolve só os chamados do solicitante informado, mesmo havendo
chamados de outros solicitantes no banco.
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    requester_a = User(
        name="Usuário A Meus Chamados", email="teste.meuschamados.a@example.com",
        role="end_user", password_hash="x",
    )
    requester_b = User(
        name="Usuário B Meus Chamados", email="teste.meuschamados.b@example.com",
        role="end_user", password_hash="x",
    )
    db.add_all([requester_a, requester_b])
    db.commit()
    db.refresh(requester_a)
    db.refresh(requester_b)

    ticket_a = Ticket(title="Chamado do A", description="x", status="open", requester_id=requester_a.id)
    ticket_b = Ticket(title="Chamado do B", description="x", status="open", requester_id=requester_b.id)
    db.add_all([ticket_a, ticket_b])
    db.commit()
    db.refresh(ticket_a)
    db.refresh(ticket_b)
    print(f"[setup] requester_a={requester_a.id} requester_b={requester_b.id}")

    headers_a = {"Authorization": f"Bearer {create_access_token(requester_a)}"}

    try:
        resp = client.get("/tickets", params={"requester_id": str(requester_a.id)}, headers=headers_a)
        assert resp.status_code == 200, resp.text
        ids = [t["id"] for t in resp.json()]
        assert str(ticket_a.id) in ids
        assert str(ticket_b.id) not in ids
        print("[OK] GET /tickets?requester_id= devolve só os chamados do solicitante informado")

        print("\nTODOS OS TESTES DA FASE 4 (MEUS CHAMADOS) PASSARAM")
    finally:
        db.query(Ticket).filter(Ticket.id.in_([ticket_a.id, ticket_b.id])).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_([requester_a.id, requester_b.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
