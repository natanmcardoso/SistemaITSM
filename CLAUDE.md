# Projeto: Sistema ITSM com IA de Triagem

Projeto de portfólio pessoal. Objetivo: demonstrar capacidade de construir um sistema ITSM completo com IA nativa (não colada depois), reaproveitando a lógica de triagem já validada no projeto AIOps Copilot.

Sem foco em venda — é peça de portfólio para virada de carreira rumo a IA/automação.

Documento de referência completo (fluxos, modelo de dados, contrato de API): `design-itsm-mvp.md` (anexar junto).

---

## Status atual

- Banco Postgres criado na Neon (projeto `Sistema ITSM`, região `sa-east-1`), `neonctl` inicializado, connection string em `.env` (**nunca commitar**)
- ✅ Fase 1 — modelo de dados + migrations (testada)
- ✅ Fase 2 — endpoints core de `tickets` (CRUD, sem IA) (testada)
- ✅ Fase 3 — triagem por IA plugada na criação de chamados (testada; modo mock por padrão, live com `ANTHROPIC_API_KEY`)
- ✅ Fase 4.0 — autenticação (login + JWT) (testada) — sub-fase levantada ao iniciar a Fase 4: o design doc lista `/auth/login` mas nenhuma das 4 fases originais cobria implementá-lo. Escopo: `password_hash` em `users`, hashing bcrypt, JWT (`app/security.py`), `POST /auth/login`, `GET /auth/me`. **Os endpoints de `tickets` ainda não exigem token** — isso é plugado junto com a tela de fila do técnico, não antes.
- `JWT_SECRET` gerado e salvo em `.env` (**nunca commitar**)
- ✅ Fase 4, tela 1/3 — fila do técnico (testada visualmente pelo usuário) — `frontend/` novo: Vite + React + TypeScript + React Router + Tailwind CSS. Login por seletor de técnico (`POST /auth/login`, senha `demo1234` preenchida automaticamente) + fila (`GET /tickets`) dividida em "Meus chamados" / "Fila geral — não atribuídos". `backend/scripts/seed_dev_data.py` (idempotente) povoa técnicos/categorias/chamados de dev; `frontend/src/devData.ts` espelha manualmente esses IDs/nomes (decisão abaixo: sem `GET /users`/`GET /categories`). Precisou de `CORSMiddleware` no backend liberando `http://localhost:5173` — não estava no design original, foi descoberto ao integrar de verdade.
- ✅ Fase 4, tela 2/3 — novo chamado (testada via browser automation — login usuário final → criação de chamado → sugestão da IA exibida → chamado conferido na fila do técnico como não atribuído). Fluxo do usuário final: formulário (título + descrição) → `POST /tickets` com `requester_id` do usuário logado → tela de confirmação mostra `ai_suggested_category_id`/`ai_suggested_priority`. Decisão levantada ao iniciar a tela: o seletor de login (antes só técnicos) foi estendido para listar também os usuários finais semeados (`devData.ts` → `LOGIN_ACCOUNTS`, com `role`); o destino pós-login passou a ser decidido pela role (`frontend/src/auth/routing.ts` → `homeRouteForRole`: `end_user` → `/novo-chamado`, demais → `/fila`). A etapa "sugestão de artigo da KB + botão resolveu/não resolveu" do design doc (§2.1) **não foi implementada** — os endpoints `GET /kb-articles` e `POST /tickets/{id}/resolve-by-user` não existem no backend ainda (fora do escopo das fases já feitas); fica para quando/se essa parte for priorizada.
- ✅ Fase 4, tela 3/3 — dashboard do gestor (testada: `backend/test_phase4_dashboard.py` passando + verificação visual via browser automation). Duas decisões levantadas e confirmadas com o usuário antes de codar:
  1. **Escopo do dashboard = só dado real.** `sla_due_at` nunca é calculado (`sla_rules` não é usada em nenhum código) e `resolved_by_ai` nunca é setado (endpoint `resolve-by-user` não existe) — então "SLA estourado" e "% resolvido por IA" (2 das 4 métricas centrais do design doc §2.3) **não entraram**. `GET /dashboard/summary` (novo, `app/routers/dashboard.py`, restrito a `role=manager` via `require_role`) devolve: `total_tickets`, `by_status`, `top_categories` (por `category_id` final, não pela sugestão) e `ai_accuracy_priority`/`ai_accuracy_category` (sugerida vs. valor final — mantida/reclassificada, só contando chamados em que a IA de fato sugeriu algo). Fica registrado como pendência: se/quando SLA e resolve-by-user forem implementados, essas duas métricas entram no dashboard.
  2. **Guard de autenticação plugado em `/tickets`** (`dependencies=[Depends(get_current_user)]` no router) — dívida da Fase 4.0 que não tinha sido paga na tela 1/3, apesar do que o CLAUDE.md dizia; qualquer usuário logado pode chamar (sem restrição de role, pois usuário final e técnico usam os mesmos endpoints). `test_phase2_tickets_api.py` e `test_phase3_ai_triage.py` foram atualizados para mandar `Authorization: Bearer` (token gerado direto via `create_access_token`, sem passar por `/auth/login`).
  - Login estendido de novo: `LOGIN_ACCOUNTS` agora inclui Beatriz Lima (manager); `homeRouteForRole` roteia `manager` → `/dashboard`.
- ✅ `test_phase1_data_model.py` corrigido — estava quebrado desde que `seed_dev_data.py` passou a deixar uma categoria "Rede" persistida no banco: a limpeza do teste fazia `DELETE FROM categories WHERE name = 'Rede'`, que colidia com a categoria real (violação de FK, tickets seedados referenciam ela). Fix: limpeza passou a ser por ID capturado na criação (mesmo padrão dos outros `test_phaseN_*.py`), não por nome/conteúdo; a categoria de teste também ganhou um nome distinto (`"Rede (teste fase 1)"`) para não colidir visualmente com a real no dashboard. Também foram removidos os dados órfãos que a execução quebrada tinha deixado no Neon (2 categorias "Rede" duplicadas, users/sla_rule/kb_article/ticket/interaction de teste soltos).
- ✅ Fase 4, sub-fase SLA (testada: `backend/test_phase4_sla.py`, + `test_phase4_dashboard.py` reconfirmado, + verificação visual via browser automation) — primeira das duas lacunas do dashboard fechadas (a outra é resolve-by-user, ainda pendente). Escopo:
  - `sla_rules` semeada em `seed_dev_data.py` (4 prioridades: critical=4h, high=8h, medium=24h, low=72h de `resolution_time_hours`) — tabela existia desde a Fase 1 mas nunca tinha sido populada.
  - `app/services/sla.py` (`compute_sla_due_at`): `sla_due_at` = `created_at` + `resolution_time_hours` da regra da prioridade final. Sem regra cadastrada pra aquela prioridade → fica nulo (mesmo padrão de degradação graciosa da triagem por IA).
  - `POST /tickets` calcula `sla_due_at` na criação; `PATCH /tickets/{id}` recalcula **sempre que `priority` muda**, mas a partir de `created_at` (não do instante do PATCH) — decisão de design: reclassificar prioridade não pode "resetar o relógio" do SLA.
  - Dashboard ganhou `sla: {tracked_total, breached}` — estourado = `sla_due_at` no passado + status não é `resolved`/`closed`.
  - `SLARule.priority` é única (só 4 valores no enum) — `test_phase4_sla.py` e o `test_phase1_data_model.py` (corrigido de novo aqui) reaproveitam a regra já semeada em vez de tentar duplicar, pra não colidir com o seed.
  - Backfill manual (uma vez, direto no Neon, fora de qualquer script versionado) nos chamados que o seed já tinha deixado sem `sla_due_at`; o chamado "Sem acesso à VPN" foi backdatado 3 dias de propósito pra nascer com SLA estourado e o dashboard ter algo pra mostrar na demo.
- ✅ Fase 4, sub-fase resolve-by-user (testada: `backend/test_phase4_resolve_by_user.py` + `test_phase4_dashboard.py` reconfirmado + fluxo completo via browser automation) — fecha a última lacuna do dashboard; as 4 métricas centrais do design doc (§2.3) têm dado real agora. Decisão confirmada com o usuário antes de codar: sugestão de artigo da KB casada por `category_id` (sem envolver a IA), não pela IA escolhendo o artigo como o design doc (§5) imagina — simplificação de propósito pra não mexer no serviço de triagem já fechado e testado. Escopo:
  - `kb_articles` semeada em `seed_dev_data.py` (1 artigo por categoria, 4 no total).
  - Novo router `app/routers/kb_articles.py`: `GET /kb-articles?category_id=` (lista/filtra) e `GET /kb-articles/{id}` (detalhe) — cobre o contrato do design doc (§4), mas com filtro por categoria em vez de busca livre por `query` (não há caso de uso pra busca textual hoje).
  - Novo `POST /tickets/{id}/resolve-by-user`: só o `requester_id` do chamado pode chamar (403 senão) e só enquanto `status == "open"` (400 senão) — seta `status=resolved` + `resolved_by_ai=true`.
  - Dashboard ganhou `ai_resolution: {total_tickets, resolved_by_ai}`; frontend com card em destaque (verde, no topo da tela) — é a métrica central do diferencial do projeto.
  - `NewTicketPage.tsx`: depois de criar o chamado, busca `GET /kb-articles?category_id=` pela categoria final; se achar artigo, mostra com botões "Resolveu, pode fechar" (chama `resolve-by-user`) / "Não resolveu" (segue pro fluxo de sempre — chamado vai pra fila). Sem artigo pra categoria, pula direto pra confirmação de sempre.
  - **Achado e corrigido durante o teste:** `test_phase3_ai_triage.py` tinha o mesmo bug de fundo do `test_phase1` (já corrigido antes) — criava uma categoria "Hardware" própria que colidia com a real do seed (nome não é único no schema; a IA mock casa categoria por nome exato). Estava passando por sorte de ordenação do banco até quebrar nesta fase. Fix: mesmo padrão "reusa se existir, só limpa se criou" já usado pra `SLARule`.
- ✅ Redesign visual das 4 telas (login, fila do técnico, novo chamado, dashboard) — puramente visual, sem mudança de lógica/backend, testado via browser automation em todas as 4. Processo:
  1. Usuário trouxe 5 prints de referência (`Prototipos do sistema/`) — produtos de helpdesk/CRM distintos, não um design system único. Validado com a skill `design` (Claude Design canvas): sintetizei uma primeira direção (sidebar azul vibrante, cards de KPI, badges por prioridade/status) — usuário achou "muito igual às referências", pediu pra inovar.
  2. Segunda rodada: 3 direções bem diferentes entre si (mesma tela — fila do técnico — pra comparar de forma justa) — A) "Console": dark, rail de ícones, mono/neon; B) "Editorial": claro/quente, sem sidebar colorida, serif itálico, paleta terrosa; C) "Blocks": preto+laranja, blocos sólidos, tipografia caixa-alta. Usuário decidiu voltar pra direção original (V1).
  3. V1 aprovado, implementado em código de verdade (não ficou só no mockup).
  - **Tokens** (`frontend/src/index.css`, via `@theme` do Tailwind v4): fonte Plus Jakarta Sans (Google Fonts); cores `primary`/`primary-dark`/`primary-tint` (azul), `crit`/`high`/`med`/`low` (+ tints, prioridade), `st-open`/`st-progress`/`st-resolved`/`st-closed` (+ tints, status).
  - Novo `frontend/src/components/Sidebar.tsx` (compartilhada entre fila e dashboard — usuário final não usa, tem só 1 destino) e `frontend/src/components/icons.tsx` (SVGs inline, sem lib de ícone externa). **De propósito, a sidebar só lista o item real de cada persona** — não replica o "Base de conhecimento" do mockup, que não existe como tela ainda (evita implicar feature não construída).
  - `PriorityBadge`/`StatusBadge` reestilizados pros tokens novos (prioridade = ponto colorido + texto; status = pill com fundo tintado).
  - Mockups de referência ficam publicados num Claude Design canvas (fora do repo) — não há link salvo aqui; se precisar revisitar o processo, os prints originais estão em `Prototipos do sistema/`.
- ✅ Tela de detalhe do chamado (design doc §2.2: "histórico + sugestão da IA + campo de ação") — fecha o maior gap funcional que tínhamos mapeado: até aqui, o frontend só *lia* dados (`GET /tickets`), nunca chamava `PATCH /tickets/{id}` nem criava uma `interaction`, mesmo esses endpoints já existindo desde fases anteriores. Testado: `backend/test_phase4_interactions.py` + fluxo completo via browser automation (atribuir a mim → mudar status → registrar interação → conferir reflexo na fila).
  - Backend: só 1 endpoint novo, `POST /tickets/{id}/interactions` (`InteractionCreate{content}`, `author_id` = usuário logado, sem restrição de role). `GET /tickets/{id}` e `PATCH /tickets/{id}` já existiam e só passaram a ser usados agora.
  - Frontend: nova `TicketDetailPage.tsx` (rota `/tickets/:id`); linhas da `QueuePage` viraram clicáveis. Ações do técnico: atribuir a mim, trocar status/prioridade/categoria (um `PATCH` só), registrar interação (histórico).
  - Cortes de escopo registrados (não reabrir sem motivo): reatribuição só "pra mim" (sem select de outro técnico — não temos `GET /users`); interações são só texto, sem editar/excluir/anexo; **usuário final não tem uma versão dedicada desta tela** — a URL funciona pra ele também (mesmo padrão "sem restrição de role" dos outros endpoints), mas não existe um link de entrada pra essa persona ainda; isso é o gap "acompanhamento do chamado" (§2.1), que segue em aberto.

- ✅ Fecha os 2 últimos gaps mapeados: acompanhamento do chamado pelo usuário final (§2.1) e busca de KB pelo técnico (§2.2).
  - Backend, 2 adições pequenas: `GET /tickets?requester_id=` (filtro novo, mesmo padrão do `assignee_id` já existente) e `GET /kb-articles?query=` (substring case-insensitive em título OU conteúdo, combinável com `category_id` — antes só o filtro por categoria existia). Testes novos: `test_phase4_meus_chamados.py`, `test_phase4_kb_search.py`.
  - Frontend: `Sidebar.tsx` generalizada pra aceitar uma lista de itens de navegação (antes só 1 fixo) — agora o técnico vê "Fila de chamados" + "Base de conhecimento" de verdade, renderizados como `<Link>` do react-router com estado ativo.
  - Nova `KnowledgeBasePage.tsx` (rota `/base-conhecimento`, técnico): busca por texto + filtro por categoria, lista os artigos.
  - Nova `MeusChamadosPage.tsx` (rota `/meus-chamados`, usuário final): lista os próprios chamados (`GET /tickets?requester_id=`), clicável pra abrir o detalhe. `NewTicketPage.tsx` ganhou um link "Meus chamados" no cabeçalho.
  - `TicketDetailPage.tsx` passou a servir as 2 personas com o mesmo componente: técnico vê a sidebar + o painel de ações; usuário final vê só leitura (info + sugestão da IA + histórico) num header leve, sem sidebar e sem o painel de ações — controlado por `auth.user.role === "technician"`.
  - A extensão do Claude in Chrome não conectou na hora de fechar esta fase (4 tentativas); foi validada por build limpo + `curl` direto nos endpoints novos, sem fluxo completo no navegador como as fases anteriores. **Verificação visual confirmada depois pelo usuário** (rodou os dois servidores localmente e testou as telas novas) — sem ressalva.

Próximo passo real: a Fase 4 (frontend) está funcionalmente e visualmente fechada — as 4 métricas centrais do design doc (§2.3) com dado real, as 4 telas com o design aprovado, o técnico consegue agir de verdade na fila, e os gaps de acompanhamento (usuário final) e busca de KB (técnico) do design doc estão fechados. Não há mais gap conhecido do design doc original (§2) em aberto. A Fase 5 (Navegação e Descoberta, evolução pós-MVP) também está fechada — filtros/busca na fila, dashboard clicável e responsivo, todas testadas. Próxima: Fase 6 (CMDB + Problem Management).

Três fases novas foram decididas com o usuário (fora do design doc original, evolução pós-MVP) e ficam nesta ordem — começar pela Fase 5:

- ✅ **Fase 5 — Navegação e Descoberta.** Puramente UX sobre o que já existe, sem schema novo. Escopo:
  - ✅ Sub-fase 5.1 (backend) — `GET /tickets` ganhou `category_id` e `query` (busca por texto em título/descrição, substring case-insensitive), somando-se aos filtros que já existiam (`status`/`priority`/`assignee_id`/`requester_id`). Testado: `backend/test_phase5_ticket_filters.py` + suíte completa reconfirmada (11 arquivos).
  - ✅ Sub-fase 5.2 (frontend) — barra de filtros (status, prioridade, categoria, técnico) + busca por texto na fila do técnico (`frontend/src/pages/QueuePage.tsx`), estado persistido na URL (`?status=&priority=&category=&assignee=&q=`). Sem filtro ativo, o comportamento continua idêntico ao de antes (chamados abertos/em andamento, divididos em "Meus chamados" / "Fila geral — não atribuídos"); qualquer filtro ou busca ativa troca pra uma lista única "Resultados filtrados" (pode cruzar as duas divisões, ex. `status=resolved`). Novo `TECHNICIANS` em `devData.ts` (subconjunto de `USER_NAMES`) alimenta o seletor de técnico — mesmo padrão de espelho manual já usado nesse arquivo. Testado: build limpo + verificação visual do usuário. A extensão do Claude in Chrome não conectou e o Playwright local não tinha Chromium instalado — não rodei o fluxo automatizado desta vez, ficou só com o usuário testando manualmente.
  - Busca por texto no título/descrição do chamado — ✅ feito na 5.1/5.2 acima.
  - ✅ Sub-fase 5.3 (dashboard clicável) — `GET /tickets` ganhou `sla=breached` (mesma definição de estouro do `GET /dashboard/summary.sla`: prazo no passado + status ainda aberto), testado em `test_phase5_sla_filter.py`. No dashboard: pills de status viram link pra `/fila?status=`, top categorias viram link pra `/fila?category=` (usa o reverse-lookup de `CATEGORY_NAMES` em `devData.ts`, já que `/dashboard/summary` só devolve o nome da categoria, não o id), e o card "SLA estourado" vira link pra `/fila?sla=breached` (só quando `breached > 0` — sem link morto pra zero resultado). `sla` não tem controle próprio na barra de filtros da fila, só chega via link do dashboard (mesmo padrão que `requester_id` já tinha antes de existir barra de filtros). Testado: build limpo + suíte de backend completa (12 arquivos) + verificação visual do usuário.
  - ✅ Sub-fase 5.4 (responsivo) — `Sidebar.tsx` reestruturada: abaixo de `lg` (1024px) a barra fixa de 256px vira uma topbar compacta com botão de menu que abre a mesma navegação como drawer deslizante (overlay + painel), sem duplicar conteúdo (`SidebarBody` compartilhado entre o drawer e a sidebar fixa). Novos ícones `IconMenu`/`IconX`. As 4 telas que usam `Sidebar` (fila, dashboard, base de conhecimento, detalhe do chamado — técnico) empilham em coluna no mobile (`flex-col lg:flex-row`) com padding responsivo; as telas sem sidebar (login, novo chamado, meus chamados, detalhe do chamado — usuário final) ganharam padding responsivo e cabeçalhos com `flex-wrap`. Hero do dashboard empilha em coluna no mobile. **Ressalva de verificação:** o `resize_window` da extensão do Claude in Chrome não reduz o viewport real neste ambiente (fica preso na resolução da tela real, ~1600-1900px, mesmo pedindo 390px) — em vez de screenshot, validei via JS/DOM: computed `display` da sidebar fixa (`flex`, 256px) e da topbar mobile (`none`) na largura atual confirmam o breakpoint `lg` aplicado corretamente, e testei funcionalmente o drawer mobile disparando os cliques via JS (abre com os 2 links certos, fecha certo) — a lógica dos dois lados do breakpoint ficou provada sem conseguir renderizar fisicamente estreito. Build limpo, suíte de backend completa (12 arquivos, sem mudança de backend nesta sub-fase) reconfirmada.
  - Fora do escopo desta fase (avaliar depois, menor prioridade): Kanban (arrastar chamado entre status), notificações in-app, anexos em chamados/interações, exportar relatório.
- ⏳ **Fase 6 — CMDB + Problem Management (alinhamento ITIL).** Duas tabelas novas:
  - `assets` (`id`, `name`, `type` enum: desktop/notebook/server/printer/network/other, `status` enum: active/maintenance/retired, `owner_id` FK→users nullable, `serial_number` nullable, `created_at`) — `tickets` ganha `asset_id` FK nullable.
  - `problems` (`id`, `title`, `root_cause` text nullable, `status` enum: investigating/known_error/resolved, `created_at`) — `tickets` ganha `problem_id` FK nullable.
  - Sem telas de CRUD dedicadas no MVP desta fase — só o dashboard mostrando "N chamados vinculados a este ativo/problema". Ver `design-itsm-mvp.md` para o racional completo (decisão: cobrir bem os ~6-8 práticas ITIL centrais, não as 34+ do framework — escopo de portfólio, não produto comercial).
- ⏳ **Fase 7 (futura) — RMM próprio** (agente de endpoint, inventário, acesso remoto, patch management) — mantém-se fora de escopo até as fases 5 e 6 fecharem; `asset_id` da Fase 6 já é a ponte de dados pra isso.

Decisões já tomadas para a Fase 4 (não reabrir sem motivo):
- Frontend: Vite + React + TypeScript + React Router + Tailwind CSS.
- Identidade visual aprovada (ver processo acima): sidebar azul (`--color-primary` etc. em `index.css`), Plus Jakarta Sans. Não reabrir a direção visual sem motivo novo — já passou por 2 rodadas de validação com o usuário.
- Sem tela de login "de verdade" por ora — um seletor simples de usuário/técnico/gestor no frontend, chamando `POST /auth/login` com credenciais de contas semeadas direto no banco; o destino pós-login é decidido pela `role` (`frontend/src/auth/routing.ts`).
- `GET /users` e `GET /categories` **não serão criados agora** — na prática, isso virou um espelho manual (`frontend/src/devData.ts`) dos IDs/nomes que o seed grava no Postgres; se o seed rodar de novo em outro banco, os UUIDs mudam e esse arquivo precisa ser atualizado à mão.

---

## Stack

- Backend: FastAPI (Python)
- Frontend: React
- Banco de dados: PostgreSQL (hospedado na Neon — free tier, projeto `Sistema ITSM`, `sa-east-1`)

### Configuração do banco

```
DATABASE_URL=postgresql://<user>:<senha>@<host>.sa-east-1.aws.neon.tech/neondb?sslmode=require
```
- Guardar apenas em `.env` (confirmar que `.env` está no `.gitignore` antes do primeiro commit)
- Auth pronta da Neon (Backend Services) **não foi ativada** — autenticação será implementada manualmente no FastAPI (JWT + roles por persona), de propósito, como parte do portfólio

---

## Regra de execução — OBRIGATÓRIA

**Sempre trabalhar em fases pequenas. Nunca implementar múltiplas partes do sistema de uma vez.**

Para cada fase:
1. Implementar **apenas** o escopo da fase atual
2. Escrever e rodar teste(s) que comprovem que aquela fase funciona antes de seguir
3. Reportar o resultado do teste antes de propor a próxima fase
4. Só avançar para a próxima fase depois de confirmação explícita

Não pular etapas, não adiantar código de fases futuras, não assumir que "vai dar certo" sem testar.

**Commit no Git:** ao final de cada fase testada e aprovada (não a cada alteração pontual). Mensagem de commit deve indicar a fase concluída, ex: `git commit -m "fase 1: modelo de dados + migrations testadas"`.

**README:** ao final de cada fase testada e aprovada, atualizar **ambos** `README.md` (português) e `README.en.md` (inglês) — marcar a fase concluída no roadmap, atualizar "Status atual" e adicionar/ajustar instruções de "Como rodar localmente" se a fase mudou o setup. Nunca atualizar um README sem atualizar o outro junto.

---

## Ordem de execução recomendada

1. ✅ Modelo de dados + migrations (Postgres) → testar: criar tabelas, rodar migration, inserir registro de teste
2. ✅ Endpoints core de `tickets` (CRUD), sem IA ainda → testar: criar/listar/atualizar chamado via API
3. ✅ Plugar o serviço de triagem por IA (reaproveitando lógica do AIOps Copilot) → testar: chamado novo recebe categoria/prioridade sugerida corretamente
4. ✅ Autenticação (login + JWT) — sub-fase 4.0, pré-requisito do frontend → testado: login certo/errado, `/auth/me` com/sem token
5. ✅ Frontend — fila do técnico → tela de novo chamado → dashboard do gestor (+ SLA, resolve-by-user, redesign visual, detalhe do chamado, acompanhamento do usuário final, busca de KB) → todas testadas.
6. ✅ Navegação e Descoberta — filtros + busca em `/tickets`, dashboard clicável, responsivo → todas testadas.
7. ⏳ CMDB + Problem Management — migrations de `assets`/`problems`, `asset_id`/`problem_id` em `tickets` → testar: criar asset/problem, vincular a um chamado, conferir contagem no dashboard.
8. ⏳ RMM próprio (futura) — fora de escopo até 6 e 7 fecharem.

---

## Pontos de atenção do design (não perder ao implementar)

- Sempre salvar `ai_suggested_priority` e `ai_suggested_category_id` separados do valor final (`priority`, `category_id`) — é o que permite medir o acerto da IA depois. Sem isso, o dashboard de impacto da IA não tem dado real.
- Três personas no MVP: usuário final, técnico, gestor — cada uma com fluxo e tela próprios (ver `design-itsm-mvp.md`)
- RMM (agente de endpoint, acesso remoto, patch management) está **fora do escopo** desta fase — não implementar nem preparar estrutura pra isso ainda
