"""
Teste da Fase 17, sub-fase 17.1: backend de Monitoramento — middleware de
log de requisições (RequestLog) + GET /monitoring/summary, restrito a
role=manager.

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). O log é
compartilhado com o resto da suíte (toda chamada de API grava uma linha,
inclusive as chamadas de outros arquivos de teste), então o teste usa o
padrão delta antes/depois (como os testes de dashboard) em vez de valores
absolutos. Importante: cada leitura de GET /monitoring/summary só reflete
o estado ANTES de si mesma (ela é logada depois de responder), então cada
leitura nova soma +1 pela leitura anterior, além do que aconteceu entre elas.

O cenário de erro de verdade (500) é difícil de disparar via chamada HTTP
real sem uma rota só-de-teste no código de produção — inserido direto no
banco, mesmo padrão já usado pra testar chamados "estourados" sem esperar
o tempo passar de verdade.
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import RequestLog, User
from app.security import create_access_token

client = TestClient(app)


def run():
    db = SessionLocal()
    manager = User(
        name="Gestor Monitoramento Teste", email="teste.fase17.manager@example.com",
        role="manager", password_hash="x",
    )
    technician = User(
        name="Técnico Monitoramento Teste", email="teste.fase17.technician@example.com",
        role="technician", password_hash="x",
    )
    db.add_all([manager, technician])
    db.commit()
    for u in (manager, technician):
        db.refresh(u)

    manager_headers = {"Authorization": f"Bearer {create_access_token(manager)}"}
    tech_headers = {"Authorization": f"Bearer {create_access_token(technician)}"}

    fake_error_id = None
    old_log_id = None
    try:
        # --- guard ---
        resp = client.get("/monitoring/summary", headers=tech_headers)
        assert resp.status_code == 403, resp.text
        print("[OK] GET /monitoring/summary com técnico -> 403")

        # --- baseline ---
        resp = client.get("/monitoring/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        before = resp.json()
        assert before["window_hours"] == 24
        assert before["uptime_seconds"] >= 0
        print(f"[OK] GET /monitoring/summary -> 200 (baseline: total={before['total_requests']})")

        # --- /health não é logado ---
        for _ in range(3):
            resp = client.get("/health")
            assert resp.status_code == 200

        resp = client.get("/monitoring/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        after_health = resp.json()
        # só +1 (a leitura "before" se logou depois de responder); as 3
        # chamadas a /health não contam.
        assert after_health["total_requests"] == before["total_requests"] + 1, (
            after_health["total_requests"],
            before["total_requests"],
        )
        print("[OK] GET /health não é registrado no log")

        # --- chamadas reais conhecidas incrementam total_requests ---
        for _ in range(3):
            resp = client.get("/categories", headers=manager_headers)
            assert resp.status_code == 200

        resp = client.get("/monitoring/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        after_known = resp.json()
        # +4: a leitura "after_health" (se logou) + as 3 chamadas conhecidas.
        assert after_known["total_requests"] == after_health["total_requests"] + 4, (
            after_known["total_requests"],
            after_health["total_requests"],
        )
        print("[OK] GET /monitoring/summary.total_requests reflete chamadas reais")

        # --- erro de verdade: inserido direto no banco ---
        fake_error = RequestLog(method="GET", path="/teste-erro-fase17", status_code=500, duration_ms=10)
        db.add(fake_error)
        db.commit()
        fake_error_id = fake_error.id

        resp = client.get("/monitoring/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        after_error = resp.json()
        # +2 em total: a leitura "after_known" (se logou) + o erro inserido
        # direto no banco. +1 em errors: só o erro inserido.
        assert after_error["total_requests"] == after_known["total_requests"] + 2, (
            after_error["total_requests"],
            after_known["total_requests"],
        )
        assert after_error["error_requests"] == after_known["error_requests"] + 1, (
            after_error["error_requests"],
            after_known["error_requests"],
        )
        assert after_error["error_rate_percent"] > 0
        assert any(e["path"] == "/teste-erro-fase17" and e["status_code"] == 500 for e in after_error["recent_errors"])
        print("[OK] GET /monitoring/summary -> error_requests/error_rate_percent/recent_errors refletem o erro")

        # --- janela de tempo: log fora da janela de 24h não conta ---
        old_log = RequestLog(
            method="GET",
            path="/teste-fora-da-janela-fase17",
            status_code=500,
            duration_ms=5,
            created_at=datetime.now(timezone.utc) - timedelta(hours=100),
        )
        db.add(old_log)
        db.commit()
        old_log_id = old_log.id

        resp = client.get("/monitoring/summary", headers=manager_headers)
        assert resp.status_code == 200, resp.text
        after_old = resp.json()
        # log de 100h atrás não entra na janela padrão de 24h — só o próprio
        # "after_error" (se logou) conta.
        assert after_old["total_requests"] == after_error["total_requests"] + 1, (
            after_old["total_requests"],
            after_error["total_requests"],
        )
        print("[OK] log fora da janela de 24h (window_hours padrão) não é contado")

        # --- window_hours maior inclui o log antigo ---
        resp = client.get("/monitoring/summary", params={"window_hours": 200}, headers=manager_headers)
        assert resp.status_code == 200, resp.text
        wide_window = resp.json()
        assert wide_window["window_hours"] == 200
        assert any(e["path"] == "/teste-fora-da-janela-fase17" for e in wide_window["recent_errors"])
        print("[OK] window_hours=200 inclui o log de 100h atrás")

        print("\nTODOS OS TESTES DA FASE 17 (MONITORAMENTO — BACKEND) PASSARAM")
    finally:
        if fake_error_id:
            db.query(RequestLog).filter(RequestLog.id == fake_error_id).delete()
        if old_log_id:
            db.query(RequestLog).filter(RequestLog.id == old_log_id).delete()
        db.query(User).filter(User.id.in_([manager.id, technician.id])).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
