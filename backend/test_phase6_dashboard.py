"""
Teste da Fase 6, sub-fase 6.3: GET /dashboard/summary ganha `top_assets` e
`top_problems` — "N chamados vinculados a este ativo/problema" (design:
sem tela de CRUD dedicada nesta fase, só o vínculo mostrado no dashboard).

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). O dashboard
agrega a tabela inteira, e o banco é compartilhado com o seed de dev — por
isso as asserções comparam "antes" e "depois" (delta), como test_phase4_dashboard.py.
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Asset, Problem, Ticket, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    requester = User(
        name="Usuário CMDB Dashboard Teste", email="teste.cmdbdash.requester@example.com",
        role="end_user", password_hash="x",
    )
    manager = User(
        name="Gestor CMDB Dashboard Teste", email="teste.cmdbdash.manager@example.com",
        role="manager", password_hash="x",
    )
    db.add_all([requester, manager])
    db.commit()
    for obj in (requester, manager):
        db.refresh(obj)
    print(f"[setup] requester={requester.id} manager={manager.id}")

    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}

    asset = Asset(name="Servidor de Teste Dashboard", type="server", status="active")
    problem = Problem(title="Problema de Teste Dashboard", status="investigating")
    db.add_all([asset, problem])
    db.commit()
    for obj in (asset, problem):
        db.refresh(obj)

    created_ids = []
    try:
        # --- baseline ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        before = resp.json()
        assert "top_assets" in before and "top_problems" in before
        print("[OK] GET /dashboard/summary devolve top_assets e top_problems (baseline capturada)")

        # --- 2 chamados vinculados ao asset, 1 ao problem (independentes) ---
        specs = [
            dict(title="CMDB Dash 1", asset_id=asset.id, problem_id=None),
            dict(title="CMDB Dash 2", asset_id=asset.id, problem_id=problem.id),
            dict(title="CMDB Dash 3", asset_id=None, problem_id=None),  # sem vínculo, não deve contar
        ]
        for spec in specs:
            ticket = Ticket(
                description="chamado de teste do dashboard CMDB",
                requester_id=requester.id,
                status="open",
                **spec,
            )
            db.add(ticket)
            db.flush()
            created_ids.append(ticket.id)
        db.commit()
        print(f"[setup] {len(created_ids)} chamados de teste criados (2 vinculados ao asset, 1 ao problem)")

        # --- depois: valida deltas ---
        resp = client.get("/dashboard/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        after = resp.json()

        assets_by_name = {a["name"]: a["count"] for a in after["top_assets"]}
        problems_by_name = {p["name"]: p["count"] for p in after["top_problems"]}
        assert assets_by_name[asset.name] == 2, assets_by_name
        assert problems_by_name[problem.title] == 1, problems_by_name
        print("[OK] top_assets -> Servidor de Teste Dashboard=2; top_problems -> Problema de Teste Dashboard=1")

        assert after["total_tickets"] == before["total_tickets"] + 3
        print("[OK] total_tickets += 3 (incluindo o chamado sem asset/problem)")

        print("\nTODOS OS TESTES DA FASE 6 (DASHBOARD CMDB) PASSARAM")
    finally:
        if created_ids:
            db.query(Ticket).filter(Ticket.id.in_(created_ids)).delete(synchronize_session=False)
        db.query(Problem).filter(Problem.id == problem.id).delete()
        db.query(Asset).filter(Asset.id == asset.id).delete()
        db.query(User).filter(User.id.in_([requester.id, manager.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
