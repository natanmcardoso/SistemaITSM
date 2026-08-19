# Sistema ITSM com IA de Triagem

🌐 [Read in English](./README.en.md)

Projeto de portfólio pessoal: um sistema de chamados e gerenciamento de TI (ITSM) completo, com IA de triagem nativa desde o primeiro contato do usuário — não como um recurso adicionado depois. Reaproveita a lógica de classificação já validada no projeto [AIOps Copilot](https://github.com/natanmcardoso).

> Sem foco em venda. Objetivo: demonstrar capacidade de construir um produto completo (backend, frontend, banco de dados e IA aplicada) como parte da virada de carreira para IA/automação.

---

## Status atual

✅ Fase 1 concluída e testada — modelo de dados + migrations
🚧 Próxima: Fase 2 (endpoints core de `tickets`)

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
- [ ] Fase 2 — Endpoints core de `tickets` (CRUD, sem IA)
- [ ] Fase 3 — Integração com IA de triagem
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

cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows (use .venv/bin/activate no Linux/Mac)
pip install -r requirements.txt

# aplica o schema no banco (users, categories, tickets, interactions, kb_articles, sla_rules)
python -m alembic upgrade head

# roda o teste da Fase 1 (insere e consulta registros de teste, depois limpa)
python test_phase1_data_model.py
```

---

## Licença

Projeto pessoal de estudo/portfólio.
