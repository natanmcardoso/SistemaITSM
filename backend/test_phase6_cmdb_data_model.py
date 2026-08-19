"""
Teste da Fase 6, sub-fase 6.1: modelo de dados CMDB + Problem Management
(tabelas `assets`/`problems` + `tickets.asset_id`/`problem_id`).

Sem tela de CRUD dedicada nesta fase (decisão registrada no CLAUDE.md) — o
teste só confirma que o schema existe de verdade (migration já aplicada) e
que os relacionamentos funcionam: criar um asset e um problem, vinculá-los a
um chamado, e reler.

Roda contra o banco real (Neon) e limpa os dados de teste ao final.
"""
from app.database import SessionLocal
from app.models import Asset, Problem, Ticket, User


def run():
    db = SessionLocal()
    requester_id = owner_id = asset_id = problem_id = ticket_id = None
    try:
        requester = User(
            name="Usuário Teste CMDB", email="teste.cmdb.requester@example.com",
            role="end_user", password_hash="x",
        )
        owner = User(
            name="Dono do Ativo Teste", email="teste.cmdb.owner@example.com",
            role="technician", password_hash="x",
        )
        db.add_all([requester, owner])
        db.flush()
        requester_id, owner_id = requester.id, owner.id
        print(f"[OK] users: requester={requester.id} owner={owner.id}")

        # --- assets ---
        asset = Asset(
            name="Notebook Dell Latitude - TI-042",
            type="notebook",
            status="active",
            owner_id=owner.id,
            serial_number="SN-TEST-0042",
        )
        db.add(asset)
        db.flush()
        asset_id = asset.id
        assert asset.status == "active"
        print(f"[OK] assets: criado asset={asset.id} (type=notebook, owner={owner.id})")

        # --- problems ---
        problem = Problem(
            title="Falha recorrente de energia em notebooks Dell",
            root_cause=None,
            status="investigating",
        )
        db.add(problem)
        db.flush()
        problem_id = problem.id
        assert problem.status == "investigating"
        assert problem.root_cause is None
        print(f"[OK] problems: criado problem={problem.id} (status=investigating)")

        # --- ticket vinculado aos dois ---
        ticket = Ticket(
            title="Notebook TI-042 não liga",
            description="Mesmo sintoma de outros notebooks Dell recentes.",
            status="open",
            requester_id=requester.id,
            asset_id=asset.id,
            problem_id=problem.id,
        )
        db.add(ticket)
        db.flush()
        ticket_id = ticket.id
        print(f"[OK] tickets: criado ticket={ticket.id} vinculado a asset={asset.id} e problem={problem.id}")

        db.commit()

        # --- releitura para confirmar persistência dos vínculos ---
        db.expire_all()
        reloaded = db.get(Ticket, ticket.id)
        assert reloaded is not None
        assert reloaded.asset_id == asset.id
        assert reloaded.problem_id == problem.id
        print("[OK] releitura: ticket.asset_id e ticket.problem_id persistidos corretamente")

        # --- FK nullable: ticket sem asset/problem continua válido (regra "sem CRUD dedicado" -> maioria dos chamados não terá vínculo) ---
        ticket_sem_vinculo = Ticket(
            title="Chamado genérico sem ativo/problema",
            description="Não depende de CMDB/Problem Management.",
            status="open",
            requester_id=requester.id,
        )
        db.add(ticket_sem_vinculo)
        db.flush()
        assert ticket_sem_vinculo.asset_id is None
        assert ticket_sem_vinculo.problem_id is None
        db.commit()
        print("[OK] tickets: asset_id/problem_id nullable — chamado sem vínculo continua válido")

        print("\nTODOS OS TESTES DA FASE 6 (MODELO DE DADOS CMDB) PASSARAM")
    finally:
        db.rollback()
        if ticket_id:
            db.query(Ticket).filter(
                (Ticket.id == ticket_id) | (Ticket.title == "Chamado genérico sem ativo/problema")
            ).delete(synchronize_session=False)
        if problem_id:
            db.query(Problem).filter(Problem.id == problem_id).delete()
        if asset_id:
            db.query(Asset).filter(Asset.id == asset_id).delete()
        user_ids = [i for i in (requester_id, owner_id) if i]
        if user_ids:
            db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
