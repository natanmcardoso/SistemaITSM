# ITSM System with AI-Powered Triage

🌐 [Ler em Português](./README.md)

Personal portfolio project: a complete IT ticketing and management system (ITSM), with AI-powered triage built in from the first user interaction — not bolted on afterward. Reuses the classification logic already validated in the [AIOps Copilot](https://github.com/natanmcardoso) project.

> Not intended for sale. Goal: demonstrate the ability to build a complete product (backend, frontend, database, and applied AI) as part of a career shift toward AI/automation.

---

## Current status

🚧 In development — Phase 1 (data model + migrations)

No phase has been completed and tested yet.

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

- [ ] Phase 1 — Data model + migrations
- [ ] Phase 2 — Core `tickets` endpoints (CRUD, no AI yet)
- [ ] Phase 3 — AI triage integration
- [ ] Phase 4 — Frontend (technician queue → new ticket → manager dashboard)
- [ ] Phase 5 (future) — Custom RMM integration (endpoint agent, inventory, remote access)

Full technical design (flows, data model, API contract): [`design-itsm-mvp.md`](./design-itsm-mvp.md)

---

## Running locally

```bash
git clone https://github.com/natanmcardoso/SistemaITSM.git
cd SistemaITSM
# detailed setup instructions will be added as each phase is completed
```

---

## License

Personal study/portfolio project.
