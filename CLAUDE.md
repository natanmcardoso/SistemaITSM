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

Próximo passo real: a Fase 4 (frontend) e as 4 métricas centrais do design doc (§2.3) estão 100% fechadas e testadas — dashboard do gestor com dado real em tudo. Só falta decidir o próximo passo do projeto: começar a Fase 5 (RMM, fora do escopo do MVP atual) ou revisar/polir o que já existe antes disso.

Decisões já tomadas para a Fase 4 (não reabrir sem motivo):
- Frontend: Vite + React + TypeScript + React Router + Tailwind CSS.
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
5. 🚧 Frontend — fila do técnico → tela de novo chamado → dashboard do gestor, nessa ordem → testar cada tela isoladamente antes de integrar. Ao chegar na fila do técnico, plugar o guard de autenticação (`get_current_user`/`require_role`) nos endpoints de `tickets` que ainda estão abertos.

---

## Pontos de atenção do design (não perder ao implementar)

- Sempre salvar `ai_suggested_priority` e `ai_suggested_category_id` separados do valor final (`priority`, `category_id`) — é o que permite medir o acerto da IA depois. Sem isso, o dashboard de impacto da IA não tem dado real.
- Três personas no MVP: usuário final, técnico, gestor — cada uma com fluxo e tela próprios (ver `design-itsm-mvp.md`)
- RMM (agente de endpoint, acesso remoto, patch management) está **fora do escopo** desta fase — não implementar nem preparar estrutura pra isso ainda
