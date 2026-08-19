"""
Teste da Fase 3: triagem por IA plugada na criação de chamados.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). Sem
ANTHROPIC_API_KEY no .env, o serviço roda em modo mock (heurística por
palavras-chave — app/services/triage_mock.py), o que já valida a costura
completa: chamado novo -> triagem -> ai_suggested_priority/category_id
preenchidos -> priority/category_id herdam a sugestão quando não informados
explicitamente -> valor explícito do chamador prevalece quando informado,
mas a sugestão da IA continua preservada separada (design-itsm-mvp.md §5).

Nota: desde a Fase 4 (tela 3/3), POST /tickets exige token (qualquer usuário
autenticado) — gerado direto via create_access_token, sem passar por
/auth/login (password_hash de teste é fake).

Nota 2: as categorias "Hardware"/"Acesso" usadas aqui reaproveitam as já
cadastradas (ex.: seed_dev_data.py) em vez de criar duplicadas — nome não é
único no schema e a IA mock casa por nome exato, então duas linhas com o
mesmo nome deixam a triagem ambígua (já quebrou este teste por causa disso).
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Category, Ticket, User
from app.security import create_access_token

client = TestClient(app)


def _ensure_category(db, name: str, default_sla_hours: int):
    """Reusa a categoria já cadastrada (ex.: seed_dev_data.py) em vez de criar
    uma duplicada — nome não é único no schema, e a IA mock casa por nome
    exato (app/services/triage_mock.py), então duas linhas com o mesmo nome
    deixam a triagem ambígua (já quebrou um teste por causa disso — ver
    CLAUDE.md). Devolve (categoria, criada_agora)."""
    existing = db.query(Category).filter(Category.name == name).first()
    if existing:
        return existing, False
    category = Category(name=name, default_sla_hours=default_sla_hours)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category, True


def run():
    db = SessionLocal()
    requester = User(
        name="Usuário IA Teste", email="teste.ia.requester@example.com", role="end_user",
        password_hash="x",
    )
    db.add(requester)
    db.commit()
    db.refresh(requester)

    cat_hardware, hardware_created = _ensure_category(db, "Hardware", 24)
    cat_acesso, acesso_created = _ensure_category(db, "Acesso", 8)
    print(f"[setup] requester={requester.id} categorias=Hardware/{cat_hardware.id}, Acesso/{cat_acesso.id}")

    auth_headers = {"Authorization": f"Bearer {create_access_token(requester)}"}

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
            headers=auth_headers,
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
            headers=auth_headers,
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
            headers=auth_headers,
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
            headers=auth_headers,
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
        own_category_ids = [c.id for c, created in [(cat_hardware, hardware_created), (cat_acesso, acesso_created)] if created]
        if own_category_ids:
            db.query(Category).filter(Category.id.in_(own_category_ids)).delete(synchronize_session=False)
        db.query(User).filter(User.id == requester.id).delete()
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
