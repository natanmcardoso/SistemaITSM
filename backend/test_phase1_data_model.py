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
        assert requester.id is not None
        assert requester.created_at is not None
        print(f"[OK] users: criado requester={requester.id} technician={technician.id}")

        # --- categories ---
        category = Category(name="Rede", default_sla_hours=8)
        db.add(category)
        db.flush()
        print(f"[OK] categories: criado category={category.id}")

        # --- sla_rules ---
        sla_rule = SLARule(priority="high", response_time_hours=1, resolution_time_hours=8)
        db.add(sla_rule)
        db.flush()
        print(f"[OK] sla_rules: criado sla_rule={sla_rule.id}")

        # --- kb_articles ---
        kb_article = KBArticle(
            title="Como resetar a senha de rede",
            content="Passo a passo...",
            category_id=category.id,
        )
        db.add(kb_article)
        db.flush()
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
        # limpeza dos dados de teste (ordem respeita FKs)
        db.rollback()
        db.query(Interaction).filter(Interaction.content.like("Reiniciei o AP%")).delete()
        db.query(Ticket).filter(Ticket.title == "Não consigo acessar a rede Wi-Fi").delete()
        db.query(KBArticle).filter(KBArticle.title == "Como resetar a senha de rede").delete()
        db.query(SLARule).filter(SLARule.priority == "high").delete()
        db.query(Category).filter(Category.name == "Rede").delete()
        db.query(User).filter(User.email.like("teste.%@example.com")).delete()
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
