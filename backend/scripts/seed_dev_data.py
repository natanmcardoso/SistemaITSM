"""Popula o banco com dados de desenvolvimento persistentes (Fase 4 — frontend).

Diferente dos test_phaseN_*.py (que criam e apagam dados de teste), este script
deixa os dados no banco: são as contas e categorias que o frontend usa para
login e para exibir a fila do técnico, já que não há endpoints /users e
/categories nesta fase (decisão registrada em CLAUDE.md).

Idempotente: pula qualquer registro cujo email/nome já exista, então pode ser
rodado de novo sem duplicar nada. Para resetar de vez, apague as linhas
manualmente no Neon.
"""
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import Asset, Category, KBArticle, Problem, SLARule, Ticket, User
from app.security import hash_password
from app.services.sla import compute_sla_due_at

DEMO_PASSWORD = "demo1234"

USERS = [
    {"name": "Carla Mendes", "email": "carla.mendes@itsm.dev", "role": "technician"},
    {"name": "Rafael Souza", "email": "rafael.souza@itsm.dev", "role": "technician"},
    {"name": "Beatriz Lima", "email": "beatriz.lima@itsm.dev", "role": "manager"},
    {"name": "João Pereira", "email": "joao.pereira@itsm.dev", "role": "end_user"},
    {"name": "Marina Alves", "email": "marina.alves@itsm.dev", "role": "end_user"},
    # Fase 11 (Administração) — conta pra testar a tela de admin via login.
    {"name": "Diego Nascimento", "email": "diego.nascimento@itsm.dev", "role": "admin"},
]

CATEGORIES = [
    {"name": "Hardware", "default_sla_hours": 24},
    {"name": "Software", "default_sla_hours": 16},
    {"name": "Rede", "default_sla_hours": 8},
    {"name": "Acesso e Conta", "default_sla_hours": 4},
]

# response_time_hours = prazo pra primeira resposta; resolution_time_hours =
# prazo pra sla_due_at (app/services/sla.py). Valores típicos de mercado.
SLA_RULES = [
    {"priority": "critical", "response_time_hours": 1, "resolution_time_hours": 4},
    {"priority": "high", "response_time_hours": 2, "resolution_time_hours": 8},
    {"priority": "medium", "response_time_hours": 8, "resolution_time_hours": 24},
    {"priority": "low", "response_time_hours": 24, "resolution_time_hours": 72},
]

# (title, content, category_name) — sugestão de KB por categoria (Fase 4,
# sub-fase resolve-by-user); casamento simples por category_id, sem IA
# envolvida nessa etapa (decisão registrada no CLAUDE.md).
KB_ARTICLES = [
    (
        "Notebook não liga: primeiros passos",
        "1) Confirme que o carregador está na tomada e o LED de energia acende. "
        "2) Tente um cabo/carregador diferente, se tiver. 3) Segure o botão de "
        "energia por 15s pra descarregar resíduo de energia e tente ligar de novo. "
        "Se nada disso funcionar, o chamado segue pro técnico com essas informações.",
        "Hardware",
    ),
    (
        "Erro ao abrir sistema: como limpar cache",
        "Muitos erros genéricos de sistema (erro 500, tela branca, travamento ao "
        "gerar relatório) são resolvidos limpando o cache do navegador (Ctrl+Shift+Del) "
        "e tentando em uma aba anônima. Se o erro persistir, o chamado segue pro técnico.",
        "Software",
    ),
    (
        "Como reconectar à VPN corporativa",
        "1) Desconecte e reconecte a VPN pelo aplicativo. 2) Reinicie o Wi-Fi/roteador. "
        "3) Confirme que sua senha de rede não expirou. Se a VPN continuar sem conectar "
        "após esses passos, o chamado segue pro técnico.",
        "Rede",
    ),
    (
        "Como solicitar acesso a pastas/sistemas compartilhados",
        "Acessos a pastas e sistemas compartilhados dependem de aprovação do gestor da "
        "área responsável — não são liberados automaticamente. Use este artigo só pra "
        "confirmar o processo; o chamado sempre segue pro técnico registrar a solicitação.",
        "Acesso e Conta",
    ),
]

# CMDB + Problem Management (Fase 6) — sem tela de CRUD dedicada nesta fase
# (decisão registrada no CLAUDE.md): ativos/problemas só existem pra
# demonstrar o vínculo com chamados no dashboard (TICKET_LINKS abaixo).
ASSETS = [
    {
        "name": "Notebook Dell Latitude - TI-014",
        "type": "notebook",
        "status": "active",
        "owner_email": "joao.pereira@itsm.dev",
        "serial_number": "SN-2024-014",
    },
    {
        "name": "Impressora HP LaserJet - 3º andar",
        "type": "printer",
        "status": "active",
        "owner_email": None,
        "serial_number": "SN-2022-077",
    },
    {
        "name": "Servidor de Arquivos - Financeiro",
        "type": "server",
        "status": "maintenance",
        "owner_email": None,
        "serial_number": "SN-SRV-003",
    },
]

# (title, root_cause, status)
PROBLEMS = [
    ("Falha recorrente de energia em notebooks Dell", None, "investigating"),
    ("Fila de impressão trava aleatoriamente", "Driver desatualizado no servidor de impressão", "known_error"),
]

# (title, description, priority, status, category_name, requester_email,
#  assignee_email, created_days_ago) — created_days_ago backdata created_at
# pra alguns chamados nascerem com SLA já estourado (demo do dashboard).
TICKETS = [
    (
        "Notebook não liga",
        "Notebook não liga mais desde ontem à tarde, luz de energia não acende.",
        "high",
        "open",
        "Hardware",
        "joao.pereira@itsm.dev",
        "carla.mendes@itsm.dev",
        0,
    ),
    (
        "Erro ao abrir sistema financeiro",
        "Sistema financeiro trava com erro 500 ao gerar relatório mensal.",
        "critical",
        "open",
        "Software",
        "marina.alves@itsm.dev",
        "carla.mendes@itsm.dev",
        0,
    ),
    (
        "Sem acesso à VPN",
        "Não consigo conectar na VPN corporativa desde a atualização de ontem.",
        "medium",
        "open",
        "Rede",
        "joao.pereira@itsm.dev",
        None,
        3,  # medium = 24h de resolução -> backdatado 3 dias = SLA estourado
    ),
    (
        "Solicitação de acesso ao Drive compartilhado",
        "Preciso de acesso à pasta compartilhada do time de marketing.",
        "low",
        "in_progress",
        "Acesso e Conta",
        "marina.alves@itsm.dev",
        "rafael.souza@itsm.dev",
        0,
    ),
    (
        "Impressora do 3º andar não imprime",
        "Fila de impressão trava e nada sai da impressora do 3º andar.",
        "low",
        "open",
        "Hardware",
        "joao.pereira@itsm.dev",
        None,
        0,
    ),
    (
        "Notebook do financeiro também não liga",
        "Mesmo comportamento do outro notebook Dell: não liga, luz de energia apagada.",
        "high",
        "open",
        "Hardware",
        "marina.alves@itsm.dev",
        None,
        0,
    ),
]

# (ticket_title, asset_name_ou_None, problem_title_ou_None) — vincula
# chamados já semeados acima aos ativos/problemas (Fase 6). asset_id marca o
# equipamento físico específico; problem_id agrupa chamados pela mesma causa
# raiz — os dois são independentes (o segundo notebook do financeiro entra
# no mesmo problem sem ter asset próprio cadastrado).
TICKET_LINKS = [
    ("Notebook não liga", "Notebook Dell Latitude - TI-014", "Falha recorrente de energia em notebooks Dell"),
    ("Notebook do financeiro também não liga", None, "Falha recorrente de energia em notebooks Dell"),
    (
        "Impressora do 3º andar não imprime",
        "Impressora HP LaserJet - 3º andar",
        "Fila de impressão trava aleatoriamente",
    ),
    ("Erro ao abrir sistema financeiro", "Servidor de Arquivos - Financeiro", None),
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

        for r in SLA_RULES:
            existing = db.query(SLARule).filter(SLARule.priority == r["priority"]).first()
            if existing:
                continue
            rule = SLARule(
                priority=r["priority"],
                response_time_hours=r["response_time_hours"],
                resolution_time_hours=r["resolution_time_hours"],
            )
            db.add(rule)
            print(f"[criado] sla_rule: {rule.priority}")

        for title, content, cat_name in KB_ARTICLES:
            existing = db.query(KBArticle).filter(KBArticle.title == title).first()
            if existing:
                continue
            article = KBArticle(title=title, content=content, category_id=categories_by_name[cat_name].id)
            db.add(article)
            print(f"[criado] kb_article: {title}")

        assets_by_name = {}
        for a in ASSETS:
            existing = db.query(Asset).filter(Asset.name == a["name"]).first()
            if existing:
                assets_by_name[a["name"]] = existing
                continue
            asset = Asset(
                name=a["name"],
                type=a["type"],
                status=a["status"],
                owner_id=users_by_email[a["owner_email"]].id if a["owner_email"] else None,
                serial_number=a["serial_number"],
            )
            db.add(asset)
            db.flush()
            assets_by_name[a["name"]] = asset
            print(f"[criado] asset: {asset.name}")

        problems_by_title = {}
        for title, root_cause, status in PROBLEMS:
            existing = db.query(Problem).filter(Problem.title == title).first()
            if existing:
                problems_by_title[title] = existing
                continue
            problem = Problem(title=title, root_cause=root_cause, status=status)
            db.add(problem)
            db.flush()
            problems_by_title[title] = problem
            print(f"[criado] problem: {title}")

        db.commit()

        for title, description, priority, status, cat_name, requester_email, assignee_email, days_ago in TICKETS:
            existing = db.query(Ticket).filter(Ticket.title == title).first()
            if existing:
                continue
            created_at = datetime.now(timezone.utc) - timedelta(days=days_ago)
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
                created_at=created_at,
                sla_due_at=compute_sla_due_at(priority, db, from_time=created_at),
            )
            db.add(ticket)
            print(f"[criado] ticket: {title}")

        db.commit()

        for ticket_title, asset_name, problem_title in TICKET_LINKS:
            ticket = db.query(Ticket).filter(Ticket.title == ticket_title).first()
            if ticket is None:
                continue
            changed = False
            if asset_name and ticket.asset_id is None:
                ticket.asset_id = assets_by_name[asset_name].id
                changed = True
            if problem_title and ticket.problem_id is None:
                ticket.problem_id = problems_by_title[problem_title].id
                changed = True
            if changed:
                print(f"[vinculado] ticket '{ticket_title}' -> asset={asset_name} problem={problem_title}")

        db.commit()

        print("\n--- Contas de teste (senha para todas: demo1234) ---")
        for u in USERS:
            print(f"  {u['role']:<12} {u['email']}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
