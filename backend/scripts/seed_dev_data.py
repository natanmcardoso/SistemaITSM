"""Popula o banco com dados de desenvolvimento persistentes (Fase 4 — frontend).

Diferente dos test_phaseN_*.py (que criam e apagam dados de teste), este script
deixa os dados no banco: são as contas e categorias que o frontend usa para
login e para exibir a fila do técnico, já que não há endpoints /users e
/categories nesta fase (decisão registrada em CLAUDE.md).

Idempotente: pula qualquer registro cujo email/nome já exista, então pode ser
rodado de novo sem duplicar nada. Para resetar de vez, apague as linhas
manualmente no Neon.
"""
from app.database import SessionLocal
from app.models import Category, Ticket, User
from app.security import hash_password

DEMO_PASSWORD = "demo1234"

USERS = [
    {"name": "Carla Mendes", "email": "carla.mendes@itsm.dev", "role": "technician"},
    {"name": "Rafael Souza", "email": "rafael.souza@itsm.dev", "role": "technician"},
    {"name": "Beatriz Lima", "email": "beatriz.lima@itsm.dev", "role": "manager"},
    {"name": "João Pereira", "email": "joao.pereira@itsm.dev", "role": "end_user"},
    {"name": "Marina Alves", "email": "marina.alves@itsm.dev", "role": "end_user"},
]

CATEGORIES = [
    {"name": "Hardware", "default_sla_hours": 24},
    {"name": "Software", "default_sla_hours": 16},
    {"name": "Rede", "default_sla_hours": 8},
    {"name": "Acesso e Conta", "default_sla_hours": 4},
]

# (title, description, priority, status, category_name, requester_email, assignee_email)
TICKETS = [
    (
        "Notebook não liga",
        "Notebook não liga mais desde ontem à tarde, luz de energia não acende.",
        "high",
        "open",
        "Hardware",
        "joao.pereira@itsm.dev",
        "carla.mendes@itsm.dev",
    ),
    (
        "Erro ao abrir sistema financeiro",
        "Sistema financeiro trava com erro 500 ao gerar relatório mensal.",
        "critical",
        "open",
        "Software",
        "marina.alves@itsm.dev",
        "carla.mendes@itsm.dev",
    ),
    (
        "Sem acesso à VPN",
        "Não consigo conectar na VPN corporativa desde a atualização de ontem.",
        "medium",
        "open",
        "Rede",
        "joao.pereira@itsm.dev",
        None,
    ),
    (
        "Solicitação de acesso ao Drive compartilhado",
        "Preciso de acesso à pasta compartilhada do time de marketing.",
        "low",
        "in_progress",
        "Acesso e Conta",
        "marina.alves@itsm.dev",
        "rafael.souza@itsm.dev",
    ),
    (
        "Impressora do 3º andar não imprime",
        "Fila de impressão trava e nada sai da impressora do 3º andar.",
        "low",
        "open",
        "Hardware",
        "joao.pereira@itsm.dev",
        None,
    ),
]


def run():
    db = SessionLocal()
    try:
        users_by_email = {}
        for u in USERS:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if existing:
                users_by_email[u["email"]] = existing
                continue
            user = User(
                name=u["name"],
                email=u["email"],
                role=u["role"],
                password_hash=hash_password(DEMO_PASSWORD),
            )
            db.add(user)
            db.flush()
            users_by_email[u["email"]] = user
            print(f"[criado] user {user.role}: {user.email}")

        categories_by_name = {}
        for c in CATEGORIES:
            existing = db.query(Category).filter(Category.name == c["name"]).first()
            if existing:
                categories_by_name[c["name"]] = existing
                continue
            category = Category(name=c["name"], default_sla_hours=c["default_sla_hours"])
            db.add(category)
            db.flush()
            categories_by_name[c["name"]] = category
            print(f"[criado] category: {category.name}")

        db.commit()

        for title, description, priority, status, cat_name, requester_email, assignee_email in TICKETS:
            existing = db.query(Ticket).filter(Ticket.title == title).first()
            if existing:
                continue
            ticket = Ticket(
                title=title,
                description=description,
                priority=priority,
                status=status,
                category_id=categories_by_name[cat_name].id,
                requester_id=users_by_email[requester_email].id,
                assignee_id=users_by_email[assignee_email].id if assignee_email else None,
                ai_suggested_priority=priority,
                ai_suggested_category_id=categories_by_name[cat_name].id,
            )
            db.add(ticket)
            print(f"[criado] ticket: {title}")

        db.commit()

        print("\n--- Contas de teste (senha para todas: demo1234) ---")
        for u in USERS:
            print(f"  {u['role']:<12} {u['email']}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
