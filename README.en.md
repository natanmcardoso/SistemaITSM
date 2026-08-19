# ITSM System with AI-Powered Triage

🌐 [Ler em Português](./README.md)

Personal portfolio project: a complete IT ticketing and management system (ITSM), with AI-powered triage built in from the first user interaction — not bolted on afterward. Reuses the classification logic already validated in the [AIOps Copilot](https://github.com/natanmcardoso) project.

> Not intended for sale. Goal: demonstrate the ability to build a complete product (backend, frontend, database, and applied AI) as part of a career shift toward AI/automation.

---

## Current status

✅ Phase 1 completed and tested — data model + migrations
✅ Phase 2 completed and tested — core `tickets` endpoints (CRUD, no AI)
🚧 Next: Phase 3 (AI triage integration)

---

## Stack

- **Backend:** FastAPI (Python)
- **Frontend:** React
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
- [ ] Phase 3 — AI triage integration
- [ ] Phase 4 — Frontend (technician queue → new ticket → manager dashboard)
- [ ] Phase 5 (future) — Custom RMM integration (endpoint agent, inventory, remote access)

Full technical design (flows, data model, API contract): [`design-itsm-mvp.md`](./design-itsm-mvp.md)

---

## Running locally

```bash
git clone https://github.com/natanmcardoso/SistemaITSM.git
cd SistemaITSM

# create a .env in the project root with:
# DATABASE_URL=postgresql://<user>:<password>@<host>.sa-east-1.aws.neon.tech/neondb?sslmode=require

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
```

### Available endpoints (Phase 2)

```
GET    /health
POST   /tickets                     → creates a ticket (status=open, no AI triage yet)
GET    /tickets                     → list (filters: status, priority, assignee_id)
GET    /tickets/{id}                → detail + interaction history
PATCH  /tickets/{id}                → updates status/priority/category_id/assignee_id
```

---

## License

Personal study/portfolio project.
