# Sistema ITSM com IA de Triagem

🌐 [Read in English](./README.en.md)

Projeto de portfólio pessoal: um sistema de chamados e gerenciamento de TI (ITSM) completo, com IA de triagem nativa desde o primeiro contato do usuário — não como um recurso adicionado depois. Reaproveita a lógica de classificação já validada no projeto [AIOps Copilot](https://github.com/natanmcardoso).

> Sem foco em venda. Objetivo: demonstrar capacidade de construir um produto completo (backend, frontend, banco de dados e IA aplicada) como parte da virada de carreira para IA/automação.

---

## Status atual

✅ Fase 1 concluída e testada — modelo de dados + migrations
✅ Fase 2 concluída e testada — endpoints core de `tickets` (CRUD, sem IA)
✅ Fase 3 concluída e testada — triagem por IA plugada na criação de chamados (modo mock por padrão; live com Anthropic quando `ANTHROPIC_API_KEY` estiver configurada)
✅ Fase 4.0 concluída e testada — autenticação (login + JWT), pré-requisito da Fase 4 (frontend)
🚧 Próxima: Fase 4 (frontend) — fila do técnico

---

## Stack

- **Backend:** FastAPI (Python)
- **Frontend:** React
- **Banco de dados:** PostgreSQL (hospedado na [Neon](https://neon.tech))
- **IA:** serviço de triagem reaproveitado do AIOps Copilot

---

## Personas

- **Usuário final** — abre chamados, recebe sugestão automática da IA (categoria, prioridade, artigo da base de conhecimento)
- **Técnico (N1/N2)** — atende fila já triada pela IA, pode reclassificar
- **Gestor/supervisor** — acompanha dashboard de SLA, volume e impacto da IA (% resolvido sem intervenção humana)

---

## Roadmap

- [x] Fase 1 — Modelo de dados + migrations
- [x] Fase 2 — Endpoints core de `tickets` (CRUD, sem IA)
- [x] Fase 3 — Integração com IA de triagem
- [x] Fase 4.0 — Autenticação (login + JWT)
- [ ] Fase 4 — Frontend (fila do técnico → novo chamado → dashboard)
- [ ] Fase 5 (futura) — RMM próprio integrado (agente de endpoint, inventário, acesso remoto)

Desenho técnico completo (fluxos, modelo de dados, contrato de API): [`design-itsm-mvp.md`](./design-itsm-mvp.md)

---

## Como rodar localmente

```bash
git clone https://github.com/natanmcardoso/SistemaITSM.git
cd SistemaITSM

# crie um .env na raiz com:
# DATABASE_URL=postgresql://<user>:<senha>@<host>.sa-east-1.aws.neon.tech/neondb?sslmode=require
#
# opcional — só necessário pro modo live da triagem por IA (Fase 3):
# ANTHROPIC_API_KEY=
# LLM_MODEL=claude-haiku-4-5
# Sem ANTHROPIC_API_KEY, a triagem roda em modo mock (heurística local, sem custo de API).
#
# obrigatório a partir da Fase 4.0 — segredo de assinatura dos JWTs de login:
# JWT_SECRET=<gere com: python -c "import secrets; print(secrets.token_urlsafe(48))">


cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows (use .venv/bin/activate no Linux/Mac)
pip install -r requirements.txt

# aplica o schema no banco (users, categories, tickets, interactions, kb_articles, sla_rules)
python -m alembic upgrade head

# roda o teste da Fase 1 (insere e consulta registros de teste, depois limpa)
python test_phase1_data_model.py

# sobe a API
python -m uvicorn app.main:app --reload
# docs interativas em http://127.0.0.1:8000/docs

# roda o teste da Fase 2 (CRUD de tickets via API real, depois limpa)
python test_phase2_tickets_api.py

# roda o teste da Fase 3 (triagem por IA via API real, modo mock por padrão, depois limpa)
python test_phase3_ai_triage.py

# roda o teste da Fase 4.0 (login + JWT via API real, depois limpa)
python test_phase4_0_auth.py
```

### Endpoints disponíveis

```
GET    /health
POST   /auth/login                  → login (email + senha) → JWT
GET    /auth/me                     → dados do usuário autenticado (requer Bearer token)
POST   /tickets                     → cria chamado (triagem por IA roda automaticamente)
GET    /tickets                     → lista (filtros: status, priority, assignee_id)
GET    /tickets/{id}                → detalhe + histórico de interações
PATCH  /tickets/{id}                → atualiza status/priority/category_id/assignee_id
```

### Triagem por IA (Fase 3)

- Ao criar um chamado (`POST /tickets`), o título + descrição são enviados ao serviço de triagem, que sugere `priority` (severidade) e `category_id` (casando com as categorias já cadastradas — se nenhuma bater, fica nulo, sem criar categoria nova).
- A sugestão é sempre salva em `ai_suggested_priority` / `ai_suggested_category_id`, separada do valor final (`priority` / `category_id`) — isso é o que permite medir o acerto da IA depois (design-itsm-mvp.md §5).
- Se `priority`/`category_id` não forem informados na criação, o valor sugerido pela IA vira o valor inicial do chamado (editável depois via `PATCH`). Se forem informados explicitamente, prevalecem — mas a sugestão da IA continua registrada.
- **Modo mock** (padrão, sem `ANTHROPIC_API_KEY`): heurística local por palavras-chave (`app/services/triage_mock.py`) — não chama API externa, usada nos testes automatizados.
- **Modo live** (com `ANTHROPIC_API_KEY` configurada): chama a Anthropic (Claude), reaproveitando o padrão de prompt/parse/retry/fallback validado no [AIOps Copilot](https://github.com/natanmcardoso).

### Autenticação (Fase 4.0)

- Login por email/senha (`POST /auth/login`) retorna um JWT (HS256, expira em 8h) e os dados do usuário (`id`, `name`, `email`, `role`).
- Endpoints que exigem login usam o header `Authorization: Bearer <token>`; `GET /auth/me` é o endpoint de referência para validar o token.
- **Não há cadastro público de usuário nesta fase** — contas são criadas direto no banco (senha com hash bcrypt via `app.security.hash_password`). Um endpoint de cadastro fica para uma fase futura, se necessário.
- Os endpoints de `tickets` ainda não exigem autenticação — isso é plugado junto com a Fase 4 (frontend), quando a fila do técnico passa a chamar a API com o token do login.

---

## Licença

Projeto pessoal de estudo/portfólio.
