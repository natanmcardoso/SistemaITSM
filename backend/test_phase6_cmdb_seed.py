"""
Teste da Fase 6, sub-fase 6.2: seed de assets/problems + vínculo com
chamados (`backend/scripts/seed_dev_data.py`).

Diferente dos outros test_phaseN_*.py, este não cria/apaga dados de teste —
`seed_dev_data.py` é idempotente e deixa dados persistentes no banco (mesmo
padrão do resto do seed: usuários, categorias etc.). Este teste só confirma,
lendo o banco real, que a última execução do seed deixou os ativos/problemas
e os vínculos esperados. Rode `python scripts/seed_dev_data.py` antes deste
teste se ainda não tiver rodado.
"""
from app.database import SessionLocal
from app.models import Asset, Problem, Ticket


def run():
    db = SessionLocal()
    try:
        # --- assets semeados ---
        notebook = db.query(Asset).filter(Asset.name == "Notebook Dell Latitude - TI-014").first()
        printer = db.query(Asset).filter(Asset.name == "Impressora HP LaserJet - 3º andar").first()
        server = db.query(Asset).filter(Asset.name == "Servidor de Arquivos - Financeiro").first()
        assert notebook is not None and notebook.type == "notebook" and notebook.status == "active"
        assert notebook.owner_id is not None, "notebook deveria ter owner_id (joão pereira)"
        assert printer is not None and printer.type == "printer"
        assert server is not None and server.type == "server" and server.status == "maintenance"
        print("[OK] assets: os 3 ativos semeados existem com type/status corretos")

        # --- problems semeados ---
        power_problem = db.query(Problem).filter(
            Problem.title == "Falha recorrente de energia em notebooks Dell"
        ).first()
        printer_problem = db.query(Problem).filter(
            Problem.title == "Fila de impressão trava aleatoriamente"
        ).first()
        assert power_problem is not None and power_problem.status == "investigating"
        assert printer_problem is not None and printer_problem.status == "known_error"
        assert printer_problem.root_cause is not None
        print("[OK] problems: os 2 problemas semeados existem com status/root_cause corretos")

        # --- vínculos com chamados ---
        t1 = db.query(Ticket).filter(Ticket.title == "Notebook não liga").first()
        t2 = db.query(Ticket).filter(Ticket.title == "Notebook do financeiro também não liga").first()
        t3 = db.query(Ticket).filter(Ticket.title == "Impressora do 3º andar não imprime").first()
        t4 = db.query(Ticket).filter(Ticket.title == "Erro ao abrir sistema financeiro").first()
        assert t1 is not None and t1.asset_id == notebook.id and t1.problem_id == power_problem.id
        assert t2 is not None and t2.asset_id is None and t2.problem_id == power_problem.id
        assert t3 is not None and t3.asset_id == printer.id and t3.problem_id == printer_problem.id
        assert t4 is not None and t4.asset_id == server.id and t4.problem_id is None
        print("[OK] tickets: vínculos com asset/problem batem com TICKET_LINKS do seed")

        # --- agregação: problema de energia tem 2 chamados vinculados ---
        power_count = db.query(Ticket).filter(Ticket.problem_id == power_problem.id).count()
        assert power_count == 2, f"esperado 2 chamados vinculados ao problema de energia, achou {power_count}"
        print("[OK] agregação: 'Falha recorrente de energia em notebooks Dell' tem 2 chamados vinculados")

        print("\nTODOS OS TESTES DA FASE 6 (SEED CMDB) PASSARAM")
    finally:
        db.close()


if __name__ == "__main__":
    run()
