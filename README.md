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
✅ Fase 4 (frontend) concluída e testada — fila do técnico, novo chamado e dashboard do gestor, incluindo as sub-fases de SLA e resolve-by-user: as 4 métricas centrais do design doc (§2.3) têm dado real no dashboard
✅ Identidade visual própria aplicada nas 4 telas — sidebar azul, tipografia Plus Jakarta Sans, badges por prioridade/status (processo de design documentado no `CLAUDE.md`)
✅ Tela de detalhe do chamado — técnico consegue atribuir, mudar status/prioridade/categoria e registrar histórico, direto pela UI
✅ Acompanhamento do chamado (usuário final) + busca de KB (técnico) — fecham os últimos gaps do design doc (§2.1/§2.2)
✅ Fase 5 (Navegação e Descoberta) concluída e testada — filtros + busca na fila, dashboard clicável e as 4 telas responsivas (breakpoints Tailwind + sidebar em drawer no mobile)

---

## Stack

- **Backend:** FastAPI (Python)
- **Frontend:** React (Vite + TypeScript, React Router, Tailwind CSS)
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
- [x] Fase 4 — Frontend (fila do técnico → novo chamado → dashboard)
  - [x] Fila do técnico
  - [x] Novo chamado
  - [x] Dashboard do gestor
- [x] Fase 5 — Navegação e Descoberta
  - [x] Filtros (status, prioridade, categoria, técnico) + busca por texto na fila do técnico
  - [x] Dashboard clicável (métricas viram links pra fila já filtrada)
  - [x] Responsivo (breakpoints Tailwind nas telas; sidebar vira drawer no mobile)
- [ ] Fase 6 (futura) — CMDB + Problem Management (alinhamento ITIL)
- [ ] Fase 7 (futura) — RMM próprio integrado (agente de endpoint, inventário, acesso remoto)

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

# roda o teste do dashboard do gestor + guard de autenticação em /tickets
# (Fase 4, tela 3/3), via API real, depois limpa
python test_phase4_dashboard.py

# roda o teste de SLA (cálculo de sla_due_at + métrica de estouro no
# dashboard), via API real, depois limpa
python test_phase4_sla.py

# roda o teste de resolve-by-user (KB por categoria + usuário fechando o
# próprio chamado via sugestão da IA), via API real, depois limpa
python test_phase4_resolve_by_user.py

# roda o teste do histórico de interações (tela de detalhe do chamado),
# via API real, depois limpa
python test_phase4_interactions.py

# roda o teste do filtro requester_id (acompanhamento do chamado) e o da
# busca de KB por texto, via API real, depois limpam
python test_phase4_meus_chamados.py
python test_phase4_kb_search.py

# popula o banco com dados de dev persistentes (usuários, categorias,
# sla_rules, kb_articles, chamados de exemplo) — necessário pras 3 telas do
# frontend terem o que mostrar. Idempotente, pode rodar de novo sem
# duplicar. Senha de todas as contas: demo1234
python scripts/seed_dev_data.py
```

### Frontend (Fase 4)

```bash
cd frontend
npm install

# cria frontend/.env (aponta pra API local)
cp .env.example .env

npm run dev
# http://localhost:5173/login — escolha uma conta (técnico, usuário final ou
# gestor; senha demo1234 preenchida automaticamente)
# - técnico cai na fila (chamados semeados)
# - usuário final cai direto na tela de novo chamado
# - gestor cai direto no dashboard
```

> Sem endpoint `GET /users`/`GET /categories` nesta fase (decisão do design) — os
> nomes exibidos na fila vêm de um espelho manual do seed em `frontend/src/devData.ts`.
> Se rodar `seed_dev_data.py` num banco novo, os UUIDs mudam e esse arquivo precisa
> ser atualizado à mão.

### Endpoints disponíveis

```
GET    /health
POST   /auth/login                  → login (email + senha) → JWT
GET    /auth/me                     → dados do usuário autenticado (requer Bearer token)
POST   /tickets                     → cria chamado (triagem por IA roda automaticamente) — requer login
GET    /tickets                     → lista (filtros: status, priority, category_id, assignee_id, requester_id, query, sla=breached) — requer login
GET    /tickets/{id}                → detalhe + histórico de interações — requer login
PATCH  /tickets/{id}                → atualiza status/priority/category_id/assignee_id — requer login
POST   /tickets/{id}/interactions   → registra uma entrada de histórico no chamado — requer login
POST   /tickets/{id}/resolve-by-user → usuário fecha o próprio chamado via sugestão da IA — requer login (só o solicitante)
GET    /kb-articles                 → lista/busca artigos da KB (filtros opcionais ?category_id= e ?query=) — requer login
GET    /kb-articles/{id}            → detalhe de um artigo — requer login
GET    /dashboard/summary           → métricas do dashboard do gestor — requer login com role=manager
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
- Os endpoints de `tickets` exigem autenticação desde a Fase 4, tela 3/3 (qualquer usuário logado, sem restrição de role) — `GET /dashboard/summary` vai além e restringe a `role=manager` via `require_role`.

### Fila do técnico (Fase 4, tela 1/3)

- Login (`POST /auth/login`) via seletor simples de técnico — sem tela de senha, a senha das contas semeadas (`demo1234`) já vai preenchida.
- A fila (`GET /tickets`) é dividida em "Meus chamados" (atribuídos ao técnico logado) e "Fila geral — não atribuídos", ordenada por prioridade sugerida pela IA.
- Cada linha mostra a prioridade final e, quando o técnico reclassificou, a sugestão original da IA ao lado — visualização direta do dado que alimenta a métrica de acerto da IA (design-itsm-mvp.md §5).
- Backend com `CORSMiddleware` liberando `http://localhost:5173` (único origin de dev permitido).
- Cada linha da fila é clicável e abre a tela de detalhe do chamado (ver seção própria abaixo).

### Novo chamado (Fase 4, tela 2/3)

- Fluxo do usuário final (design-itsm-mvp.md §2.1): formulário com título + descrição, `POST /tickets` envia `requester_id` do usuário logado e dispara a triagem por IA automaticamente.
- Depois de criar, busca `GET /kb-articles?category_id=` pela categoria final do chamado; se achar artigo, mostra a sugestão com "Resolveu, pode fechar" (chama `resolve-by-user`) / "Não resolveu" — ver seção própria abaixo. Sem artigo pra categoria, pula direto pra confirmação (categoria/prioridade sugeridas pela IA).
- Login estendido: o mesmo seletor de contas da tela de fila agora também lista os usuários finais semeados (João Pereira, Marina Alves); o destino pós-login é decidido pela `role` (`end_user` → `/novo-chamado`, `technician` → `/fila`).

### Dashboard do gestor (Fase 4, tela 3/3)

- `GET /dashboard/summary` (restrito a `role=manager`) devolve volume de chamados por status, top categorias, SLA estourado, % resolvido por IA e o acerto da IA na triagem — sugestão vs. valor final de `priority`/`category_id` (design-itsm-mvp.md §5), só contando chamados em que a IA de fato sugeriu algo. As 4 métricas centrais do design doc (§2.3) têm dado real.
- Guard de autenticação plugado em `/tickets` nesta tela (dívida da Fase 4.0 que ainda estava aberta): qualquer usuário logado pode chamar, sem restrição de role.
- Login estendido de novo: o seletor agora também lista Beatriz Lima (manager); login como gestor cai direto em `/dashboard`.

### SLA (Fase 4, sub-fase pós tela 3/3)

- `sla_rules` semeada (`scripts/seed_dev_data.py`) com 4 prioridades — `resolution_time_hours`: critical=4h, high=8h, medium=24h, low=72h.
- `sla_due_at` calculado em `POST /tickets` (criação) e recalculado em `PATCH /tickets/{id}` sempre que `priority` muda — mas a partir de `created_at`, não do instante do PATCH, pra reclassificar prioridade não "resetar o relógio" do SLA.
- Dashboard mostra chamados com SLA estourado (`sla_due_at` no passado + status ainda aberto).

### Resolve-by-user (Fase 4, sub-fase pós SLA)

- Fecha a última lacuna do dashboard: `% resolvido por IA` — a métrica central do diferencial do projeto (design-itsm-mvp.md §2.3).
- **Simplificação de escopo:** o design doc (§5) imagina a IA de triagem já devolvendo o artigo sugerido junto com categoria/prioridade. Aqui a sugestão é feita casando por `category_id` (`kb_articles` semeada com 1 artigo por categoria), sem envolver a IA nessa etapa — não mexe no serviço de triagem já fechado e testado.
- `GET /kb-articles?category_id=` (também cobre `GET /kb-articles/{id}`) lista os artigos da categoria do chamado.
- `POST /tickets/{id}/resolve-by-user`: só o `requester_id` do chamado pode chamar (403 senão) e só enquanto `status == "open"` (400 senão) — seta `status=resolved` + `resolved_by_ai=true`.
- Dashboard ganhou o card `% resolvido pela IA, sem técnico` em destaque, no topo da tela.

### Redesign visual (Fase 4, pós resolve-by-user)

- As 4 telas (login, fila, novo chamado, dashboard) ganharam identidade visual própria — sidebar azul, tipografia Plus Jakarta Sans, badges por prioridade/status. Puramente visual, sem mudança de lógica.
- Processo documentado no `CLAUDE.md`: partiu de prints de referência trazidos pelo usuário, validados com um canvas de design (2 rodadas — uma direção "parecida com a referência" e depois 3 direções bem diferentes) antes de virar código de verdade.

### Tela de detalhe do chamado (Fase 4, pós redesign visual)

- Fecha o maior gap funcional que restava: até aqui, o frontend só lia dados — nunca chamava `PATCH /tickets/{id}` nem criava uma interação, mesmo esses endpoints já existindo.
- Nova rota `/tickets/{id}` (linhas da fila viraram clicáveis). O técnico pode: atribuir o chamado a si mesmo, trocar status/prioridade/categoria (um único `PATCH`), e registrar atualizações no histórico (`POST /tickets/{id}/interactions`).
- Reatribuição só "pra mim" (sem select de outro técnico — não há `GET /users`). Interações são só texto, sem editar/excluir/anexo.

### Acompanhamento do chamado + busca de KB (Fase 4, fecha os últimos gaps do design doc)

- **Acompanhamento pelo usuário final (§2.1):** nova tela `/meus-chamados` — lista os próprios chamados (`GET /tickets?requester_id=`), clicável pra abrir o detalhe. `NewTicketPage` ganhou um link "Meus chamados" no cabeçalho.
- **Busca de KB pelo técnico (§2.2):** nova tela `/base-conhecimento` — busca por texto (`GET /kb-articles?query=`, substring case-insensitive em título ou conteúdo) + filtro por categoria. Sidebar do técnico agora tem os dois itens de verdade (Fila de chamados + Base de conhecimento).
- `TicketDetailPage` passou a servir as 2 personas com o mesmo componente: técnico vê a sidebar + painel de ações; usuário final vê só leitura (info + sugestão da IA + histórico), sem sidebar e sem o painel de ações.
- Com isso, não há mais gap conhecido do design doc original (§2) em aberto.

### Filtros e busca na fila (Fase 5 — Navegação e Descoberta)

- `GET /tickets` ganhou `category_id` e `query` (busca por texto em título/descrição, substring case-insensitive), somando-se aos filtros já existentes (`status`, `priority`, `assignee_id`, `requester_id`).
- A fila do técnico ganhou uma barra de filtros (status, prioridade, categoria, técnico) + busca por texto, com o estado persistido na URL (`?status=&priority=&category=&assignee=&q=`) — dá pra copiar/colar o link já filtrado.
- Sem filtro ativo, a fila continua exatamente como antes (chamados abertos/em andamento, divididos em "Meus chamados" / "Fila geral — não atribuídos"). Com qualquer filtro ou busca ativa, vira uma lista única "Resultados filtrados", que pode cruzar as duas divisões (ex.: `status=resolved`).

### Dashboard clicável (Fase 5 — Navegação e Descoberta)

- `GET /tickets` ganhou `sla=breached` — mesma definição de estouro usada em `GET /dashboard/summary.sla` (prazo no passado + status ainda aberto).
- No dashboard do gestor, cada métrica vira link pra fila já filtrada: os pills de status (`Aberto`, `Em andamento`...) levam pra `/fila?status=`, cada categoria em "Top categorias" leva pra `/fila?category=`, e o card "SLA estourado" leva pra `/fila?sla=breached` (só quando há chamado estourado — sem link morto).

### Responsivo (Fase 5 — Navegação e Descoberta)

- `Sidebar.tsx` (fila, dashboard, base de conhecimento, detalhe do chamado — técnico) abaixo de `1024px` de largura vira uma topbar compacta com botão de menu, que abre a mesma navegação como um drawer deslizante — sem sidebar fixa de 256px comendo a tela do celular.
- As demais telas (login, novo chamado, meus chamados, detalhe do chamado — usuário final) ganharam padding e cabeçalhos responsivos.

---

## Licença

Projeto pessoal de estudo/portfólio.
