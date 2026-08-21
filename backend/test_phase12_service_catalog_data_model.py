"""
Teste da Fase 12, sub-fase 12.1: modelo de dados do Catálogo de Serviços
(tabela `services` + `tickets.service_id`).

Sem tela de CRUD dedicada nesta sub-fase (fica pra 12.2/12.3) — o teste só
confirma que o schema existe de verdade (migration já aplicada) e que os
relacionamentos funcionam: criar uma categoria, um serviço vinculado a ela,
um chamado vinculado ao serviço, e reler.

Roda contra o banco real (Neon) e limpa os dados de teste ao final.
"""
from app.database import SessionLocal
from app.models import Category, Service, Ticket, User


def run():
    db = SessionLocal()
    requester_id = category_id = service_id = ticket_id = None
    try:
        requester = User(
            name="Usuário Teste Catálogo", email="teste.catalogo.requester@example.com",
            role="end_user", password_hash="x",
        )
        db.add(requester)
        db.flush()
        requester_id = requester.id
        print(f"[OK] user: requester={requester.id}")

        # --- categoria + serviço ---
        category = Category(name="Categoria Teste Fase 12", default_sla_hours=8)
        db.add(category)
        db.flush()
        category_id = category.id

        service = Service(
            name="Solicitar novo notebook",
            category_id=category.id,
            description="Abertura de chamado pra pedir um notebook novo ou de reposição.",
        )
        db.add(service)
        db.flush()
        service_id = service.id
        assert service.category_id == category.id
        assert service.description is not None
        print(f"[OK] services: criado service={service.id} vinculado a category={category.id}")

        # --- serviço sem descrição (nullable) ---
        service_sem_descricao = Service(name="Serviço sem descrição", category_id=category.id)
        db.add(service_sem_descricao)
        db.flush()
        assert service_sem_descricao.description is None
        db.delete(service_sem_descricao)
        db.flush()
        print("[OK] services: description nullable")

        # --- ticket vinculado ao serviço ---
        ticket = Ticket(
            title="Preciso de um notebook novo",
            description="O meu atual não liga mais.",
            status="open",
            requester_id=requester.id,
            category_id=category.id,
            service_id=service.id,
        )
        db.add(ticket)
        db.flush()
        ticket_id = ticket.id
        print(f"[OK] tickets: criado ticket={ticket.id} vinculado a service={service.id}")

        db.commit()

        # --- releitura para confirmar persistência do vínculo ---
        db.expire_all()
        reloaded = db.get(Ticket, ticket.id)
        assert reloaded is not None
        assert reloaded.service_id == service.id
        print("[OK] releitura: ticket.service_id persistido corretamente")

        # --- FK nullable: ticket sem serviço continua válido (maioria dos chamados não passa pelo catálogo) ---
        ticket_sem_servico = Ticket(
            title="Chamado aberto por texto livre, sem catálogo",
            description="Não depende do Catálogo de Serviços.",
            status="open",
            requester_id=requester.id,
        )
        db.add(ticket_sem_servico)
        db.flush()
        assert ticket_sem_servico.service_id is None
        db.commit()
        print("[OK] tickets: service_id nullable — chamado sem vínculo continua válido")

        print("\nTODOS OS TESTES DA FASE 12 (MODELO DE DADOS DO CATÁLOGO DE SERVIÇOS) PASSARAM")
    finally:
        db.rollback()
        if ticket_id:
            db.query(Ticket).filter(
                (Ticket.id == ticket_id) | (Ticket.title == "Chamado aberto por texto livre, sem catálogo")
            ).delete(synchronize_session=False)
        if service_id:
            db.query(Service).filter(Service.id == service_id).delete()
        if category_id:
            db.query(Category).filter(Category.id == category_id).delete()
        if requester_id:
            db.query(User).filter(User.id == requester_id).delete()
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
