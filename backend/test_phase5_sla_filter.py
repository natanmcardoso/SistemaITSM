"""
Teste da Fase 5 (Navegação e Descoberta), sub-fase 5.3 (dashboard clicável):
filtro `sla=breached` em GET /tickets — alimenta o link "SLA estourado" do
dashboard, usando a mesma definição de estouro do
GET /dashboard/summary.sla (app/routers/dashboard.py): sla_due_at no
passado + status ainda não resolvido/fechado.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon).
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    requester = User(
        name="Usuário Fase5 SLA Filtro", email="teste.fase5.slafiltro@example.com",
        role="end_user", password_hash="x",
    )
    db.add(requester)
    db.commit()
    db.refresh(requester)

    now = datetime.now(timezone.utc)
    breached = Ticket(
        title="Chamado estourado", description="passou do prazo e continua aberto",
        status="open", requester_id=requester.id,
        created_at=now - timedelta(days=10), sla_due_at=now - timedelta(days=9),
    )
    breached_but_resolved = Ticket(
        title="Chamado estourado mas resolvido", description="passou do prazo, porém já foi resolvido",
        status="resolved", requester_id=requester.id,
        created_at=now - timedelta(days=10), sla_due_at=now - timedelta(days=9),
    )
    not_breached = Ticket(
        title="Chamado dentro do prazo", description="ainda não venceu",
        status="open", requester_id=requester.id,
        created_at=now, sla_due_at=now + timedelta(days=1),
    )
    no_sla = Ticket(
        title="Chamado sem sla calculado", description="sem prioridade reconhecida em sla_rules",
        status="open", requester_id=requester.id,
    )
    db.add_all([breached, breached_but_resolved, not_breached, no_sla])
    db.commit()
    for t in (breached, breached_but_resolved, not_breached, no_sla):
        db.refresh(t)
    print(f"[setup] tickets={breached.id},{breached_but_resolved.id},{not_breached.id},{no_sla.id}")

    headers = {"Authorization": f"Bearer {create_access_token(requester)}"}

    try:
        resp = client.get("/tickets", params={"sla": "breached"}, headers=headers)
        assert resp.status_code == 200, resp.text
        ids = [t["id"] for t in resp.json()]
        assert str(breached.id) in ids
        assert str(breached_but_resolved.id) not in ids
        assert str(not_breached.id) not in ids
        assert str(no_sla.id) not in ids
        print("[OK] GET /tickets?sla=breached devolve só chamados com prazo vencido e ainda abertos")

        resp = client.get("/tickets", params={"sla": "outro-valor"}, headers=headers)
        assert resp.status_code == 200, resp.text
        ids = [t["id"] for t in resp.json()]
        assert str(breached.id) in ids and str(not_breached.id) in ids
        print("[OK] sla= com valor diferente de 'breached' não filtra (ignorado)")

        print("\nTODOS OS TESTES DA FASE 5 (FILTRO SLA) PASSARAM")
    finally:
        db.query(Ticket).filter(
            Ticket.id.in_([breached.id, breached_but_resolved.id, not_breached.id, no_sla.id])
        ).delete(synchronize_session=False)
        db.query(User).filter(User.id == requester.id).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
