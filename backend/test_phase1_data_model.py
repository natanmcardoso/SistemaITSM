"""
Teste da Fase 1: modelo de dados + migrations.

Verifica que as tabelas existem (via migration já aplicada) e que é possível
inserir e consultar um registro de teste em cada tabela principal, respeitando
os relacionamentos do schema (design-itsm-mvp.md §3).

Roda contra o banco real (Neon) e limpa os dados de teste ao final.
"""
from app.database import SessionLocal
from app.models import Category, Interaction, KBArticle, SLARule, Ticket, User


def run():
    db = SessionLocal()
    requester_id = technician_id = category_id = None
    sla_rule_id = kb_article_id = ticket_id = interaction_id = None
    try:
        # --- users ---
        requester = User(
            name="Usuário Teste", email="teste.requester@example.com", role="end_user",
            password_hash="x",
        )
        technician = User(
            name="Técnico Teste", email="teste.technician@example.com", role="technician",
            password_hash="x",
        )
        db.add_all([requester, technician])
        db.flush()
        requester_id, technician_id = requester.id, technician.id
        assert requester.id is not None
        assert requester.created_at is not None
        print(f"[OK] users: criado requester={requester.id} technician={technician.id}")

        # --- categories ---
        # Nome com sufixo de teste para não colidir com a categoria "Rede" real
        # que o seed_dev_data.py deixa persistida no banco (a limpeza deste
        # teste já colidiu com isso antes — ver CLAUDE.md).
        category = Category(name="Rede (teste fase 1)", default_sla_hours=8)
        db.add(category)
        db.flush()
        category_id = category.id
        print(f"[OK] categories: criado category={category.id}")

        # --- sla_rules ---
        sla_rule = SLARule(priority="high", response_time_hours=1, resolution_time_hours=8)
        db.add(sla_rule)
        db.flush()
        sla_rule_id = sla_rule.id
        print(f"[OK] sla_rules: criado sla_rule={sla_rule.id}")

        # --- kb_articles ---
        kb_article = KBArticle(
            title="Como resetar a senha de rede",
            content="Passo a passo...",
            category_id=category.id,
        )
        db.add(kb_article)
        db.flush()
        kb_article_id = kb_article.id
        print(f"[OK] kb_articles: criado kb_article={kb_article.id}")

        # --- tickets (com ai_suggested_* separado do valor final, ver §5) ---
        ticket = Ticket(
            title="Não consigo acessar a rede Wi-Fi",
            description="Wi-Fi cai a cada 5 minutos no setor financeiro.",
            status="open",
            priority="medium",  # valor final, definido pelo técnico
            category_id=category.id,
            requester_id=requester.id,
            assignee_id=technician.id,
            ai_suggested_priority="high",  # valor original sugerido pela IA
            ai_suggested_category_id=category.id,
        )
        db.add(ticket)
        db.flush()
        ticket_id = ticket.id
        assert ticket.priority == "medium"
        assert ticket.ai_suggested_priority == "high"
        assert ticket.priority != ticket.ai_suggested_priority, (
            "ai_suggested_priority deve ficar preservado separado do valor final"
        )
        print(f"[OK] tickets: criado ticket={ticket.id} (priority=medium, ai_suggested_priority=high)")

        # --- interactions ---
        interaction = Interaction(
            ticket_id=ticket.id,
            author_id=technician.id,
            content="Reiniciei o AP do setor financeiro, aguardando confirmação.",
        )
        db.add(interaction)
        db.flush()
        interaction_id = interaction.id
        print(f"[OK] interactions: criado interaction={interaction.id}")

        db.commit()

        # --- releitura para confirmar persistência ---
        db.expire_all()
        reloaded = db.get(Ticket, ticket.id)
        assert reloaded is not None
        assert reloaded.title == "Não consigo acessar a rede Wi-Fi"
        assert len(reloaded.interactions) == 1
        print("[OK] releitura: ticket persistido corretamente com 1 interaction relacionada")

        print("\nTODOS OS TESTES DA FASE 1 PASSARAM")
    finally:
        # Limpeza por ID (ordem respeita FKs) — não por nome/conteúdo: o banco
        # é compartilhado com o seed de dev (seed_dev_data.py), que deixa uma
        # categoria "Rede" persistida; filtrar por nome já colidiu com ela
        # antes (violação de FK) — ver CLAUDE.md.
        db.rollback()
        if interaction_id:
            db.query(Interaction).filter(Interaction.id == interaction_id).delete()
        if ticket_id:
            db.query(Ticket).filter(Ticket.id == ticket_id).delete()
        if kb_article_id:
            db.query(KBArticle).filter(KBArticle.id == kb_article_id).delete()
        if sla_rule_id:
            db.query(SLARule).filter(SLARule.id == sla_rule_id).delete()
        if category_id:
            db.query(Category).filter(Category.id == category_id).delete()
        user_ids = [i for i in (requester_id, technician_id) if i]
        if user_ids:
            db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
