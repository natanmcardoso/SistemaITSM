"""
Teste da Fase 4 (sub-fase tela de detalhe do chamado): histórico de
interações no chamado.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). Valida:
- POST /tickets/{id}/interactions sem token -> 401.
- POST /tickets/{id}/interactions em ticket inexistente -> 404.
- POST /tickets/{id}/interactions com sucesso -> 201, author_id = quem chamou.
- GET /tickets/{id} reflete a interação criada (TicketDetailOut.interactions).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Interaction, Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    requester = User(
        name="Usuário Interação Teste", email="teste.interacao.requester@example.com",
        role="end_user", password_hash="x",
    )
    technician = User(
        name="Técnico Interação Teste", email="teste.interacao.technician@example.com",
        role="technician", password_hash="x",
    )
    db.add_all([requester, technician])
    db.commit()
    db.refresh(requester)
    db.refresh(technician)

    ticket = Ticket(
        title="Chamado interação teste",
        description="valida o historico de interacoes",
        status="open",
        requester_id=requester.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    print(f"[setup] requester={requester.id} technician={technician.id} ticket={ticket.id}")

    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}

    interaction_id = None
    try:
        # --- sem token -> 401 ---
        resp = client.post(f"/tickets/{ticket.id}/interactions", json={"content": "sem token"})
        assert resp.status_code == 401, resp.text
        print("[OK] POST /tickets/{id}/interactions sem token -> 401")

        # --- ticket inexistente -> 404 ---
        resp = client.post(
            "/tickets/00000000-0000-0000-0000-000000000000/interactions",
            json={"content": "x"},
            headers=tech_headers,
        )
        assert resp.status_code == 404, resp.text
        print("[OK] POST /tickets/{id}/interactions em ticket inexistente -> 404")

        # --- sucesso ---
        resp = client.post(
            f"/tickets/{ticket.id}/interactions",
            json={"content": "Reiniciei o equipamento, aguardando confirmação do usuário."},
            headers=tech_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        interaction_id = body["id"]
        assert body["ticket_id"] == str(ticket.id)
        assert body["author_id"] == str(technician.id)
        assert body["content"] == "Reiniciei o equipamento, aguardando confirmação do usuário."
        print("[OK] POST /tickets/{id}/interactions -> 201, author_id = quem chamou")

        # --- GET /tickets/{id} reflete a interação ---
        resp = client.get(f"/tickets/{ticket.id}", headers=tech_headers)
        assert resp.status_code == 200, resp.text
        detail = resp.json()
        assert len(detail["interactions"]) == 1
        assert detail["interactions"][0]["id"] == interaction_id
        print("[OK] GET /tickets/{id} -> interactions reflete a criada")

        print("\nTODOS OS TESTES DA FASE 4 (INTERACTIONS) PASSARAM")
    finally:
        if interaction_id:
            db.query(Interaction).filter(Interaction.id == interaction_id).delete()
        db.query(Ticket).filter(Ticket.id == ticket.id).delete()
        db.query(User).filter(User.id.in_([requester.id, technician.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
