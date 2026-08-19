# ITSM System with AI-Powered Triage

🌐 [Ler em Português](./README.md)

Personal portfolio project: a complete IT ticketing and management system (ITSM), with AI-powered triage built in from the first user interaction — not bolted on afterward. Reuses the classification logic already validated in the [AIOps Copilot](https://github.com/natanmcardoso) project.

> Not intended for sale. Goal: demonstrate the ability to build a complete product (backend, frontend, database, and applied AI) as part of a career shift toward AI/automation.

---

## Current status

✅ Phase 1 completed and tested — data model + migrations
✅ Phase 2 completed and tested — core `tickets` endpoints (CRUD, no AI)
✅ Phase 3 completed and tested — AI triage wired into ticket creation (mock mode by default; live mode with Anthropic when `ANTHROPIC_API_KEY` is set)
✅ Phase 4.0 completed and tested — authentication (login + JWT), a prerequisite for Phase 4 (frontend)
🚧 Phase 4 (frontend) in progress — screen 2/3 completed and tested: new ticket (end-user flow, creates an AI-triaged ticket)
🚧 Next: manager dashboard

---

## Stack

- **Backend:** FastAPI (Python)
- **Frontend:** React (Vite + TypeScript, React Router, Tailwind CSS)
- **Database:** PostgreSQL (hosted on [Neon](https://neon.tech))
- **AI:** triage service reused from the AIOps Copilot project

---

## Personas

- **End user** — opens tickets, gets automatic AI suggestions (category, priority, knowledge base article)
- **Technician (L1/L2)** — handles a queue already triaged by AI, can reclassify
- **Manager/supervisor** — tracks SLA dashboard, volume, and AI impact (% resolved without human intervention)

---

## Roadmap

- [x] Phase 1 — Data model + migrations
- [x] Phase 2 — Core `tickets` endpoints (CRUD, no AI yet)
- [x] Phase 3 — AI triage integration
- [x] Phase 4.0 — Authentication (login + JWT)
- [ ] Phase 4 — Frontend (technician queue → new ticket → manager dashboard)
  - [x] Technician queue
  - [x] New ticket
  - [ ] Manager dashboard
- [ ] Phase 5 (future) — Custom RMM integration (endpoint agent, inventory, remote access)

Full technical design (flows, data model, API contract): [`design-itsm-mvp.md`](./design-itsm-mvp.md)

---

## Running locally

```bash
git clone https://github.com/natanmcardoso/SistemaITSM.git
cd SistemaITSM

# create a .env in the project root with:
# DATABASE_URL=postgresql://<user>:<password>@<host>.sa-east-1.aws.neon.tech/neondb?sslmode=require
#
# optional — only needed for the AI triage live mode (Phase 3):
# ANTHROPIC_API_KEY=
# LLM_MODEL=claude-haiku-4-5
# Without ANTHROPIC_API_KEY, triage runs in mock mode (local heuristic, no API cost).
#
# required starting from Phase 4.0 — secret used to sign login JWTs:
# JWT_SECRET=<generate with: python -c "import secrets; print(secrets.token_urlsafe(48))">


cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows (use .venv/bin/activate on Linux/Mac)
pip install -r requirements.txt

# applies the schema to the database (users, categories, tickets, interactions, kb_articles, sla_rules)
python -m alembic upgrade head

# runs the Phase 1 test (inserts and queries test records, then cleans up)
python test_phase1_data_model.py

# starts the API
python -m uvicorn app.main:app --reload
# interactive docs at http://127.0.0.1:8000/docs

# runs the Phase 2 test (ticket CRUD via the real API, then cleans up)
python test_phase2_tickets_api.py

# runs the Phase 3 test (AI triage via the real API, mock mode by default, then cleans up)
python test_phase3_ai_triage.py

# runs the Phase 4.0 test (login + JWT via the real API, then cleans up)
python test_phase4_0_auth.py

# seeds the database with persistent dev data (technicians, categories, sample
# tickets) — needed so the technician queue screen has something to show.
# Idempotent, safe to re-run. Password for every seeded account: demo1234
python scripts/seed_dev_data.py
```

### Frontend (Phase 4)

```bash
cd frontend
npm install

# create frontend/.env (points to the local API)
cp .env.example .env

npm run dev
# http://localhost:5173/login — pick an account (technician or end user;
# password demo1234 is filled in automatically)
# - technician lands on the queue (seeded tickets)
# - end user lands directly on the new ticket screen
```

> No `GET /users`/`GET /categories` endpoint in this phase (design decision) —
> the names shown in the queue come from a manual mirror of the seed data in
> `frontend/src/devData.ts`. If you run `seed_dev_data.py` against a fresh
> database, the UUIDs change and that file needs to be updated by hand.

### Available endpoints

```
GET    /health
POST   /auth/login                  → login (email + password) → JWT
GET    /auth/me                     → authenticated user's data (requires Bearer token)
POST   /tickets                     → creates a ticket (AI triage runs automatically)
GET    /tickets                     → list (filters: status, priority, assignee_id)
GET    /tickets/{id}                → detail + interaction history
PATCH  /tickets/{id}                → updates status/priority/category_id/assignee_id
```

### AI triage (Phase 3)

- On ticket creation (`POST /tickets`), the title + description are sent to the triage service, which suggests `priority` (severity) and `category_id` (matched against already-registered categories — if none match, it stays null instead of creating a new category).
- The suggestion is always saved to `ai_suggested_priority` / `ai_suggested_category_id`, kept separate from the final value (`priority` / `category_id`) — that's what makes it possible to measure AI accuracy later (design-itsm-mvp.md §5).
- If `priority`/`category_id` aren't provided at creation time, the AI's suggestion becomes the ticket's initial value (editable later via `PATCH`). If they are provided explicitly, they take precedence — but the AI suggestion is still recorded.
- **Mock mode** (default, without `ANTHROPIC_API_KEY`): local keyword heuristic (`app/services/triage_mock.py`) — no external API call, used by the automated tests.
- **Live mode** (with `ANTHROPIC_API_KEY` set): calls Anthropic (Claude), reusing the prompt/parse/retry/fallback pattern validated in [AIOps Copilot](https://github.com/natanmcardoso).

### Authentication (Phase 4.0)

- Email/password login (`POST /auth/login`) returns a JWT (HS256, expires in 8h) plus the user's data (`id`, `name`, `email`, `role`).
- Endpoints that require login use the `Authorization: Bearer <token>` header; `GET /auth/me` is the reference endpoint for validating a token.
- **There's no public user signup in this phase** — accounts are created directly in the database (password hashed with bcrypt via `app.security.hash_password`). A signup endpoint is left for a future phase, if needed.
- The `tickets` endpoints don't require authentication yet — that's wired in together with Phase 4 (frontend), once the technician queue starts calling the API with the login token.

### Technician queue (Phase 4, screen 1/3)

- Login (`POST /auth/login`) via a simple technician picker — no password field, the seeded accounts' password (`demo1234`) is filled in automatically.
- The queue (`GET /tickets`) is split into "My tickets" (assigned to the logged-in technician) and "General queue — unassigned", sorted by AI-suggested priority.
- Each row shows the final priority and, when the technician reclassified it, the AI's original suggestion alongside it — a direct view of the data that feeds the AI-accuracy metric (design-itsm-mvp.md §5).
- Backend has `CORSMiddleware` allowing `http://localhost:5173` (the only dev origin permitted).

### New ticket (Phase 4, screen 2/3)

- End-user flow (design-itsm-mvp.md §2.1): a form with title + description, `POST /tickets` sends the logged-in user's `requester_id` and triggers AI triage automatically.
- The confirmation screen shows the category and priority the AI suggested at creation time — the KB article suggestion + "resolved/not resolved" step is left for a future phase, since the `kb_articles` and `resolve-by-user` endpoints don't exist in the backend yet.
- Login extended: the same account picker used on the queue screen now also lists the seeded end users (João Pereira, Marina Alves); the post-login destination is decided by `role` (`end_user` → `/novo-chamado`, `technician` → `/fila`).

---

## License

Personal study/portfolio project.
