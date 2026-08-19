"""
Teste da Fase 4.0: autenticação (login + JWT).

Sobe a app FastAPI real (TestClient) contra o banco real (Neon). Cria um
usuário de teste direto no banco com senha hasheada (não há endpoint público
de cadastro nesta fase) e valida: login com credenciais corretas devolve um
JWT válido; senha errada e email inexistente são rejeitados com 401;
GET /auth/me sem token e com token inválido também dá 401; com token válido
retorna os dados do usuário autenticado.
"""
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import User
from app.security import hash_password

client = TestClient(app)


def run():
    db = SessionLocal()
    user = User(
        name="Usuário Auth Teste",
        email="teste.auth@example.com",
        role="technician",
        password_hash=hash_password("senha-correta-123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"[setup] user={user.id}")

    try:
        # --- POST /auth/login com senha errada ---
        resp = client.post("/auth/login", json={"email": user.email, "password": "senha-errada"})
        assert resp.status_code == 401, resp.text
        print("[OK] POST /auth/login com senha errada -> 401")

        # --- POST /auth/login com email inexistente ---
        resp = client.post("/auth/login", json={"email": "nao.existe@example.com", "password": "x"})
        assert resp.status_code == 401, resp.text
        print("[OK] POST /auth/login com email inexistente -> 401")

        # --- POST /auth/login com credenciais corretas ---
        resp = client.post("/auth/login", json={"email": user.email, "password": "senha-correta-123"})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        token = body["access_token"]
        assert body["token_type"] == "bearer"
        assert body["user"]["id"] == str(user.id)
        assert body["user"]["role"] == "technician"
        assert token
        print("[OK] POST /auth/login com credenciais corretas -> token emitido")

        # --- GET /auth/me sem token ---
        resp = client.get("/auth/me")
        assert resp.status_code == 401, resp.text
        print("[OK] GET /auth/me sem token -> 401")

        # --- GET /auth/me com token inválido ---
        resp = client.get("/auth/me", headers={"Authorization": "Bearer token-invalido"})
        assert resp.status_code == 401, resp.text
        print("[OK] GET /auth/me com token inválido -> 401")

        # --- GET /auth/me com token válido ---
        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        me = resp.json()
        assert me["id"] == str(user.id)
        assert me["email"] == user.email
        print("[OK] GET /auth/me com token válido -> dados do usuário autenticado")

        print("\nTODOS OS TESTES DA FASE 4.0 (AUTH) PASSARAM")
    finally:
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
        db.close()
        print("[OK] limpeza: dados de teste removidos")


if __name__ == "__main__":
    run()
