"""
Teste da Fase 3: triagem por IA plugada na criação de chamados.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). Sem
ANTHROPIC_API_KEY no .env, o serviço roda em modo mock (heurística por
palavras-chave — app/services/triage_mock.py), o que já valida a costura
completa: chamado novo -> triagem -> ai_suggested_priority/category_id
preenchidos -> priority/category_id herdam a sugestão quando não informados
explicitamente -> valor explícito do chamador prevalece quando informado,
mas a sugestão da IA continua preservada separada (design-itsm-mvp.md §5).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Category, Ticket, User

client = TestClient(app)


def run():
    db = SessionLocal()
    requester = User(
        name="Usuário IA Teste", email="teste.ia.requester@example.com", role="end_user",
        password_hash="x",
    )
    cat_hardware = Category(name="Hardware", default_sla_hours=24)
    cat_acesso = Category(name="Acesso", default_sla_hours=8)
    db.add_all([requester, cat_hardware, cat_acesso])
    db.commit()
    db.refresh(requester)
    db.refresh(cat_hardware)
    db.refresh(cat_acesso)
    print(f"[setup] requester={requester.id} categorias=Hardware/{cat_hardware.id}, Acesso/{cat_acesso.id}")

    created_ids = []
    try:
        # --- categoria existente é reconhecida (Hardware) + severidade alta ---
        resp = client.post(
            "/tickets",
            json={
                "title": "Notebook não liga",
                "description": "Notebook do financeiro não liga desde ontem, tela azul antes de desligar.",
                "requester_id": str(requester.id),
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        created_ids.append(body["id"])
        assert body["ai_suggested_priority"] == "high"
        assert body["ai_suggested_category_id"] == str(cat_hardware.id)
        # sem priority/category_id explícitos -> herdam a sugestão da IA
        assert body["priority"] == "high"
        assert body["category_id"] == str(cat_hardware.id)
        print("[OK] chamado de hardware -> IA sugere priority=high, category=Hardware, e vira o valor inicial")

        # --- categoria existente é reconhecida (Acesso) + severidade media ---
        resp = client.post(
            "/tickets",
            json={
                "title": "Não consigo logar",
                "description": "Minha senha está bloqueada e não consigo acessar o sistema.",
                "requester_id": str(requester.id),
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        created_ids.append(body["id"])
        assert body["ai_suggested_priority"] == "medium"
        assert body["ai_suggested_category_id"] == str(cat_acesso.id)
        assert body["priority"] == "medium"
        assert body["category_id"] == str(cat_acesso.id)
        print("[OK] chamado de acesso -> IA sugere priority=medium, category=Acesso")

        # --- categoria sugerida (Infraestrutura) não existe no banco -> category_id nulo ---
        resp = client.post(
            "/tickets",
            json={
                "title": "Sistema crítico parado",
                "description": "Sistema de produção está fora do ar, urgente.",
                "requester_id": str(requester.id),
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        created_ids.append(body["id"])
        assert body["ai_suggested_priority"] == "critical"
        assert body["ai_suggested_category_id"] is None
        assert body["priority"] == "critical"
        assert body["category_id"] is None
        print("[OK] categoria sugerida sem correspondência cadastrada -> category_id fica nulo, sem quebrar")

        # --- valor explícito do chamador prevalece, mas ai_suggested_* preserva a sugestão original ---
        resp = client.post(
            "/tickets",
            json={
                "title": "Notebook não liga",
                "description": "Notebook não liga, tela azul.",
                "requester_id": str(requester.id),
                "priority": "low",
                "category_id": str(cat_acesso.id),
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        created_ids.append(body["id"])
        assert body["priority"] == "low"
        assert body["category_id"] == str(cat_acesso.id)
        assert body["ai_suggested_priority"] == "high"
        assert body["ai_suggested_category_id"] == str(cat_hardware.id)
        print("[OK] priority/category_id explícitos prevalecem; ai_suggested_* preserva a sugestão original da IA")

        print("\nTODOS OS TESTES DA FASE 3 PASSARAM")
    finally:
        if created_ids:
            db.query(Ticket).filter(Ticket.id.in_(created_ids)).delete(synchronize_session=False)
        db.query(Category).filter(Category.id.in_([cat_hardware.id, cat_acesso.id])).delete(synchronize_session=False)
        db.query(User).filter(User.id == requester.id).delete()
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
