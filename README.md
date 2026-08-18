# Sistema ITSM com IA de Triagem

🌐 [Read in English](./README.en.md)

Projeto de portfólio pessoal: um sistema de chamados e gerenciamento de TI (ITSM) completo, com IA de triagem nativa desde o primeiro contato do usuário — não como um recurso adicionado depois. Reaproveita a lógica de classificação já validada no projeto [AIOps Copilot](https://github.com/natanmcardoso).

> Sem foco em venda. Objetivo: demonstrar capacidade de construir um produto completo (backend, frontend, banco de dados e IA aplicada) como parte da virada de carreira para IA/automação.

---

## Status atual

🚧 Em desenvolvimento — Fase 1 (modelo de dados + migrations)

Nenhuma fase foi concluída e testada ainda.

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

- [ ] Fase 1 — Modelo de dados + migrations
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
# instruções detalhadas de setup serão adicionadas conforme cada fase for concluída
```

---

## Licença

Projeto pessoal de estudo/portfólio.
