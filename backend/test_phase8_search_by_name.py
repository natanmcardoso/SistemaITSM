"""
Teste da Fase 8, sub-fase 8.3: busca ampliada em GET /tickets?query= —
passa a casar também por nome do solicitante e do técnico atribuído (join
com users), além de título/descrição (já existia desde a Fase 5).

Sobe a app FastAPI real (TestClient) contra o banco real (Neon).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    requester = User(
        name="Zelia Nomeunico Solicitante", email="teste.fase8.requester@example.com",
        role="end_user", password_hash="x",
    )
    technician = User(
        name="Wagner Nomeunico Tecnico", email="teste.fase8.technician@example.com",
        role="technician", password_hash="x",
    )
    other_requester = User(
        name="Outra Pessoa Qualquer", email="teste.fase8.outra@example.com",
        role="end_user", password_hash="x",
    )
    db.add_all([requester, technician, other_requester])
    db.commit()
    for u in (requester, technician, other_requester):
        db.refresh(u)

    ticket_by_requester = Ticket(
        title="Chamado sem termo no titulo", description="nada a ver aqui",
        status="open", requester_id=requester.id,
    )
    ticket_by_assignee = Ticket(
        title="Outro chamado qualquer", description="também sem termo nenhum",
        status="open", requester_id=other_requester.id, assignee_id=technician.id,
    )
    ticket_unrelated = Ticket(
        title="Chamado de ninguém especial", description="não deve aparecer em nenhuma busca por nome",
        status="open", requester_id=other_requester.id,
    )
    db.add_all([ticket_by_requester, ticket_by_assignee, ticket_unrelated])
    db.commit()
    for t in (ticket_by_requester, ticket_by_assignee, ticket_unrelated):
        db.refresh(t)
    print(f"[setup] tickets={ticket_by_requester.id},{ticket_by_assignee.id},{ticket_unrelated.id}")

    headers = {"Authorization": f"Bearer {create_access_token(requester)}"}

    try:
        resp = client.get("/tickets", params={"query": "Zelia Nomeunico"}, headers=headers)
        assert resp.status_code == 200, resp.text
        ids = [t["id"] for t in resp.json()]
        assert str(ticket_by_requester.id) in ids
        assert str(ticket_by_assignee.id) not in ids
        assert str(ticket_unrelated.id) not in ids
        print("[OK] GET /tickets?query=<nome do solicitante> encontra o chamado certo")

        resp = client.get("/tickets", params={"query": "Wagner Nomeunico"}, headers=headers)
        assert resp.status_code == 200, resp.text
        ids = [t["id"] for t in resp.json()]
        assert str(ticket_by_assignee.id) in ids
        assert str(ticket_by_requester.id) not in ids
        assert str(ticket_unrelated.id) not in ids
        print("[OK] GET /tickets?query=<nome do técnico atribuído> encontra o chamado certo")

        # título/descrição continuam funcionando (não regrediu)
        resp = client.get("/tickets", params={"query": "ninguém especial"}, headers=headers)
        assert resp.status_code == 200, resp.text
        ids = [t["id"] for t in resp.json()]
        assert str(ticket_unrelated.id) in ids
        print("[OK] busca por título/descrição continua funcionando")

        print("\nTODOS OS TESTES DA FASE 8 (BUSCA POR NOME) PASSARAM")
    finally:
        db.query(Ticket).filter(
            Ticket.id.in_([ticket_by_requester.id, ticket_by_assignee.id, ticket_unrelated.id])
        ).delete(synchronize_session=False)
        db.query(User).filter(
            User.id.in_([requester.id, technician.id, other_requester.id])
        ).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
