"""
Teste da Fase 14, sub-fase 14.1: backend do dashboard expandido —
GET /dashboard/summary ganhou `productivity_by_technician` (gestor) e novo
GET /dashboard/my-summary (dashboard pessoal do técnico).

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). O dashboard
do gestor agrega a tabela inteira, então usa o padrão delta antes/depois
(como test_phase4_dashboard.py); o dashboard do técnico é naturalmente
isolado por assignee_id (um técnico novo por execução não tem chamado
nenhum antes do teste), então valida direto, sem delta.
"""
import time

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    suffix = str(int(time.time()))
    requester = User(
        name="Usuário Dashboard14 Teste", email=f"teste.dash14.requester.{suffix}@example.com",
        role="end_user", password_hash="x",
    )
    technician = User(
        name=f"Técnico Dashboard14 Teste {suffix}", email=f"teste.dash14.technician.{suffix}@example.com",
        role="technician", password_hash="x",
    )
    other_technician = User(
        name="Outro Técnico Dashboard14 Teste", email=f"teste.dash14.other.{suffix}@example.com",
        role="technician", password_hash="x",
    )
    manager = User(
        name="Gestor Dashboard14 Teste", email=f"teste.dash14.manager.{suffix}@example.com",
        role="manager", password_hash="x",
    )
    db.add_all([requester, technician, other_technician, manager])
    db.commit()
    for u in (requester, technician, other_technician, manager):
        db.refresh(u)
    print(f"[setup] requester={requester.id} technician={technician.id} manager={manager.id}")

    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}
    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}

    created_ids = []
    try:
        # --- guards: GET /dashboard/my-summary ---
        resp = client.get("/dashboard/my-summary")
        assert resp.status_code == 401, resp.text
        print("[OK] GET /dashboard/my-summary sem token -> 401")

        resp = client.get("/dashboard/my-summary", headers=manager_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /dashboard/my-summary com token de gestor -> 403")

        # --- baseline do dashboard do gestor (produtividade) ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        before = resp.json()

        # --- chamados de teste: 2 concluídos pro técnico principal, 1 pro outro ---
        specs = [
            # atribuídos ao técnico principal (usado no my-summary abaixo)
            dict(title="T14-1", priority="critical", status="open", assignee_id=technician.id),
            dict(title="T14-2", priority="high", status="in_progress", assignee_id=technician.id),
            dict(title="T14-3", priority="low", status="resolved", assignee_id=technician.id),
            dict(title="T14-4", priority="low", status="closed", assignee_id=technician.id),
            # não atribuído (não deve contar em nada do técnico principal)
            dict(title="T14-5", priority="critical", status="open", assignee_id=None),
            # atribuído ao outro técnico, concluído (produtividade dele)
            dict(title="T14-6", priority="medium", status="resolved", assignee_id=other_technician.id),
        ]
        for spec in specs:
            ticket = Ticket(description="chamado de teste da Fase 14", requester_id=requester.id, **spec)
            db.add(ticket)
            db.flush()
            created_ids.append(ticket.id)
        db.commit()
        print(f"[setup] {len(created_ids)} chamados de teste criados")

        # --- GET /dashboard/my-summary (técnico principal) ---
        resp = client.get("/dashboard/my-summary", headers=tech_headers)
        assert resp.status_code == 200, resp.text
        my = resp.json()
        # T14-1 (open) + T14-2 (in_progress) contam como ativos; T14-3/4
        # (resolved/closed) e T14-5 (não atribuído a mim) ficam de fora.
        assert my["meus_chamados"] == 2, my
        assert my["pendencias"] == 1, my  # só T14-1 (open)
        assert my["criticos"] == 1, my  # só T14-1 (critical + ativo)
        assert my["aguardando_resposta"] == 1, my  # só T14-2 (in_progress)
        print("[OK] GET /dashboard/my-summary -> meus_chamados=2, pendencias=1, criticos=1, aguardando_resposta=1")

        # --- GET /dashboard/summary (gestor): produtividade por técnico ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        after = resp.json()
        prod_by_name = {p["name"]: p["count"] for p in after["productivity_by_technician"]}
        assert prod_by_name.get(technician.name) == 2, prod_by_name  # T14-3 + T14-4
        assert prod_by_name.get(other_technician.name) == 1, prod_by_name  # T14-6
        print("[OK] GET /dashboard/summary.productivity_by_technician -> conta só resolved/closed, por assignee")

        print("\nTODOS OS TESTES DA FASE 14 (DASHBOARD EXPANDIDO — BACKEND) PASSARAM")
    finally:
        if created_ids:
            db.query(Ticket).filter(Ticket.id.in_(created_ids)).delete(synchronize_session=False)
        db.query(User).filter(
            User.id.in_([requester.id, technician.id, other_technician.id, manager.id])
        ).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
