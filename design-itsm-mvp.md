# Design do Sistema ITSM com IA de Triagem

> Projeto de portfólio pessoal. Objetivo: demonstrar capacidade de construir um sistema ITSM completo com IA nativa (não colada depois), reaproveitando a lógica de triagem já validada no projeto AIOps Copilot.
>
> Este documento é a referência técnica completa (fluxos, modelo de dados, contrato de API) do sistema **como ele existe hoje** — não só o MVP original. O MVP (Fases 1-9) e toda a evolução pós-MVP planejada com o usuário (Fases 10-17: Configurações, Administração, Catálogo de Serviços, Calendários, Dashboard expandido, Relatórios, Automações, Monitoramento) estão fechados. Só resta a Fase 18 (RMM próprio), futura e fora de escopo — ver §9. Para o histórico de decisão fase a fase (o "porquê" de cada escolha, achados durante testes, etc.), ver `CLAUDE.md` — este documento aqui é o "o quê", `CLAUDE.md` é o "como chegamos até aqui".

---

## 1. Visão geral

Sistema de chamados (ITSM) onde a IA de triagem participa desde a abertura do chamado, não como um recurso colado depois. Quatro personas, um fluxo, uma base de dados.

**Stack:** FastAPI (backend, Python) + React + TypeScript + Vite + Tailwind CSS (frontend) + PostgreSQL (hospedado na Neon).

**Autenticação:** login por e-mail/senha (`POST /auth/login`) devolve um JWT (HS256, 8h). Sem cadastro público — contas são criadas via seed de desenvolvimento ou pelo admin (`POST /users`). Perfil ("role") é fixo por conta: `end_user`, `technician`, `manager` ou `admin` — sem sistema de permissões granular (RBAC configurável fica só documentado como evolução futura possível, nunca implementado; ver §8).

---

## 2. Personas e fluxos

Quatro personas, cada uma com tela(s) e navegação própria. `homeRouteForRole` decide o destino direto após o login; a Página inicial (`/inicio`) é um hub com atalhos disponível pra todas, mas não é o destino de login — é uma tela a mais.

### 2.1 Usuário final (`end_user`)

1. Abre um chamado por texto livre (`/novo-chamado`) **ou** a partir de um serviço do Catálogo (`/catalogo`) — nesse caso a categoria já vem pré-selecionada a partir do serviço escolhido.
2. A IA classifica prioridade + categoria automaticamente ao criar o chamado.
3. Se houver um artigo da base de conhecimento cadastrado pra categoria final do chamado, a tela sugere esse artigo com dois botões: "Resolveu, pode fechar" (`POST /tickets/{id}/resolve-by-user` — fecha o chamado sozinho, sem técnico, `resolved_by_ai=true`) ou "Não resolveu" (segue pro fluxo normal).
4. Acompanha os próprios chamados em `/meus-chamados`; cada um abre em `/tickets/:id`, em modo só-leitura (info, sugestão original da IA, histórico de interações do técnico) — sem o painel de ações do técnico.

**Telas:** Página inicial · Novo chamado · Catálogo de Serviços · Meus chamados · Detalhe do chamado (só leitura) · Perfil (menu do usuário, só leitura — nome/e-mail/perfil).

### 2.2 Técnico (`technician`)

1. Vê a fila em duas abas: "Meus chamados" (`/meus-atendimentos`, atribuídos a ele) e "Fila geral" (`/fila`, não atribuídos) — com filtros (status, prioridade, categoria), busca por texto (título/descrição/nome do solicitante ou do técnico atribuído), colunas customizáveis (persistidas por navegador) e ordenação por coluna.
2. Abre um chamado (`/tickets/:id`): atribui a si mesmo, muda status/prioridade/categoria (um único `PATCH`), registra interações de histórico.
3. Consulta/mantém a Base de Conhecimento (`/base-conhecimento`) — busca por texto + categoria, cria e edita artigos.
4. Acompanha o próprio desempenho em `/meu-dashboard` (meus chamados ativos, pendências, críticos, aguardando resposta).
5. Administra as configurações operacionais em `/configuracoes` (categorias, serviços do catálogo, regras de SLA, calendário de horário comercial) — mesma tela que o gestor usa.
6. Exporta o próprio resumo + os próprios chamados em `/relatorios` (CSV, ou PDF via impressão do navegador).

**Telas:** Página inicial · Meu dashboard · Meus chamados · Fila geral · Detalhe do chamado (com painel de ações) · Base de conhecimento · Configurações · Relatórios · Menu do usuário (Perfil, Minha fila, Prioridades — filtro padrão de fila salvo por navegador —, Agenda — chamados ativos ordenados por vencimento de SLA).

### 2.3 Gestor (`manager`)

1. Acompanha o dashboard (`/dashboard`): volume de chamados, distribuição por status, top categorias, SLA estourado, acerto da IA (prioridade e categoria — sugerida vs. valor final), % resolvido por IA sem técnico, produtividade por técnico, e o vínculo com CMDB/Problem Management (top ativos/problemas com mais chamados). Várias métricas são clicáveis e levam pra fila já filtrada.
2. Administra as mesmas configurações operacionais que o técnico (`/configuracoes`).
3. Exporta o resumo do dashboard + todos os chamados em `/relatorios`.
4. Configura a regra de automação e vê os chamados que a dispararam em `/automacoes`.
5. Acompanha a saúde do próprio sistema (uptime, taxa de erro) em `/monitoramento`.

**Telas:** Página inicial · Dashboard · Configurações · Relatórios · Automações · Monitoramento · Menu do usuário (só Perfil — sem fila pessoal, os outros itens do menu não se aplicam).

### 2.4 Admin (`admin`)

Persona de administração de sistema — sem sistema de permissões granular (Opção A confirmada: "perfil" continua sendo o `role` fixo). Acesso restrito a `/admin`.

1. CRUD de usuários (nome, e-mail, perfil, senha inicial — sem troca de senha nem desativação de conta).
2. CRUD de grupos (organização/roteamento de usuários — **não** controla permissão) e edição de membros.
3. Consulta a trilha de auditoria (só leitura) das ações administrativas.

**Telas:** Página inicial · Administração (3 abas: Usuários, Grupos, Auditoria).

---

## 3. Arquitetura — 6 domínios

Mapa de referência de escopo (o que está implementado, o que é decisão de portfólio deixar de fora):

| Domínio | Camada | Status | Cobre | Fora de escopo (decisão de portfólio) |
|---|---|---|---|---|
| Entrada | Fluxo | Implementado | Portal (novo chamado, catálogo), API REST | E-mail, chat, WhatsApp, telefone |
| Gestão | Fluxo | Implementado | Fila, SLA (horário comercial), prioridade por IA, workflow de status, escalonamento por problema, automações | Fluxo de aprovação formal |
| Saída | Fluxo | Implementado | Resolução via sugestão da IA, KB, relatórios (CSV/PDF) | — |
| ITSM | Domínio | Parcial | Incidente, requisição, problema, catálogo de serviços | Mudança, release |
| Ativos | Domínio | Parcial | CMDB básico | Inventário completo, RMM (agente de endpoint) |
| IA | Domínio | Parcial | Classificação, roteamento por categoria, sugestão de KB (por categoria, não pela IA) | Chatbot, análise de sentimento, resumo executivo |

Qualquer novo pedido de feature deve primeiro ser localizado nessa tabela — se cair numa célula "fora de escopo", é sinal de re-discutir antes de implementar.

---

## 4. Modelo de dados

16 tabelas. UUID como PK em todas (exceto `user_groups`, PK composta).

### `users`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| name | string | |
| email | string | único |
| role | enum | `end_user`, `technician`, `manager`, `admin` |
| password_hash | string | bcrypt |
| created_at | timestamp | |

### `groups` (Administração)
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| name | string | |
| description | text | nullable |
| created_at | timestamp | |

Organização/roteamento de usuários — **não** controla permissão.

### `user_groups` (Administração)
| campo | tipo | obs |
|---|---|---|
| user_id | UUID | PK composta, FK → users |
| group_id | UUID | PK composta, FK → groups |

Associação many-to-many, sem coluna `id` própria.

### `audit_log` (Administração)
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users — quem fez a ação |
| action | string | ex.: `create_user`, `update_group_members` |
| entity_type | string | ex.: `user`, `group` |
| entity_id | UUID | nullable |
| details | text | nullable |
| created_at | timestamp | |

### `categories`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| name | string | não é único no schema, mas barrado na aplicação (case-insensitive) — a triagem por IA casa a categoria sugerida por nome |
| default_sla_hours | int | |

### `assets` (CMDB)
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| name | string | |
| type | enum | `desktop`, `notebook`, `server`, `printer`, `network`, `other` |
| status | enum | `active`, `maintenance`, `retired` |
| owner_id | UUID | FK → users, nullable |
| serial_number | string | nullable |
| created_at | timestamp | |

Sem CRUD dedicado — semeado via script, só o vínculo com chamados aparece no dashboard.

### `problems` (Problem Management)
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| title | string | |
| root_cause | text | nullable |
| status | enum | `investigating`, `known_error`, `resolved` |
| created_at | timestamp | |

Mesma simplificação de escopo do `assets` — sem CRUD dedicado.

### `services` (Catálogo de Serviços)
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| name | string | |
| category_id | UUID | FK → categories, **obrigatório** (diferente de `tickets.category_id`) |
| description | text | nullable |
| created_at | timestamp | |

Sem formulário padronizado dinâmico por serviço (decisão de escopo) — só pré-seleciona a categoria do chamado.

### `tickets`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| title | string | |
| description | text | |
| status | enum | `open`, `in_progress`, `resolved`, `closed` |
| priority | enum | `low`, `medium`, `high`, `critical` — nullable, preenchido pela IA por padrão, editável |
| category_id | UUID | FK → categories, nullable |
| requester_id | UUID | FK → users |
| assignee_id | UUID | FK → users, nullable |
| asset_id | UUID | FK → assets, nullable |
| problem_id | UUID | FK → problems, nullable |
| service_id | UUID | FK → services, nullable — de qual serviço do catálogo o chamado veio |
| ai_suggested_priority | enum | valor original da IA, preservado pra métricas de acerto |
| ai_suggested_category_id | UUID | idem |
| resolved_by_ai | boolean | default false — setado só por `resolve-by-user` |
| sla_due_at | timestamp | nullable — calculado em horário comercial (ver §4.1) |
| created_at / updated_at | timestamp | |

### `interactions`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| ticket_id | UUID | FK → tickets |
| author_id | UUID | FK → users |
| content | text | |
| created_at | timestamp | |

Só texto — sem editar/excluir/anexo.

### `kb_articles`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| title | string | |
| content | text | |
| category_id | UUID | FK → categories, nullable |
| times_suggested | int | default 0 — existe no schema, não incrementado ainda |

### `sla_rules`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| priority | enum | único — 1 linha por prioridade, as 4 já vêm semeadas |
| response_time_hours | int | existe no schema, não usado no cálculo ainda |
| resolution_time_hours | int | usado por `compute_sla_due_at` |

### `business_hours` (Calendário — §4.1)
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| weekday | int | único — convenção `datetime.weekday()`, 0=segunda...6=domingo, 1 linha por dia |
| is_open | boolean | default true |
| start_time | time | nullable — só quando `is_open=true` |
| end_time | time | nullable |

1 calendário global fixo pro sistema inteiro — sem calendário por categoria/prioridade.

### `holidays` (Calendário — §4.1)
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| date | date | único |
| name | string | |

### `automation_rules` (Automações)
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| key | string | único — sempre `sla_near_breach` nesta fase, não editável |
| threshold_percent | int | editável, 1-100 |
| enabled | boolean | default true |

1 regra fixa, sem CRUD de regras novas.

### `request_logs` (Monitoramento)
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| method | string | |
| path | string | |
| status_code | int | |
| duration_ms | int | |
| created_at | timestamp | indexado — toda leitura filtra por janela de tempo |

1 linha por requisição HTTP real (exceto `/health`), gravada por middleware. Sem rotina de limpeza/retenção.

### 4.1 Cálculo de SLA

`sla_due_at` = `created_at` + `resolution_time_hours` (da `sla_rules` da prioridade final), **em horário comercial** — não corrido. O motor de cálculo (`add_business_hours`) pula dias fechados, feriados e horas fora da janela do dia, usando o calendário de `business_hours`/`holidays` (fuso fixo `America/Sao_Paulo`, não configurável). Se não houver regra cadastrada pra aquela prioridade, ou o calendário estiver vazio/todo fechado, `sla_due_at` fica nulo em vez de quebrar.

Reclassificar a prioridade de um chamado (`PATCH /tickets/{id}`) recalcula `sla_due_at`, mas sempre a partir do `created_at` original — nunca do instante do `PATCH` (não dá pra "resetar o relógio" reclassificando).

**"SLA estourado"** = `sla_due_at` no passado + `status` ainda não é `resolved`/`closed`. Mesma definição usada no dashboard (`sla.breached`), no filtro da fila (`?sla=breached`) e na base da regra de automação.

---

## 5. Contrato de API

Todos os endpoints (exceto `/health` e `/auth/login`) exigem `Authorization: Bearer <JWT>`. Onde não anotado, qualquer usuário autenticado pode chamar.

```
GET    /health

POST   /auth/login                   → login (email + senha) → JWT + dados do usuário
GET    /auth/me                      → dados do usuário autenticado

POST   /tickets                      → cria chamado (IA classifica automaticamente; service_id opcional herda a categoria)
GET    /tickets                      → lista (filtros: status, priority, category_id, assignee_id, requester_id, query, sla=breached)
GET    /tickets/{id}                 → detalhe + histórico de interações
PATCH  /tickets/{id}                 → atualiza status/priority/category_id/assignee_id — role=technician
POST   /tickets/{id}/interactions    → registra entrada de histórico — role=technician
POST   /tickets/{id}/resolve-by-user → usuário fecha o próprio chamado via sugestão da IA (só o solicitante, só enquanto open)

GET    /dashboard/summary            → métricas do dashboard do gestor — role=manager
GET    /dashboard/my-summary         → métricas do dashboard pessoal do técnico — role=technician

GET    /kb-articles                  → lista/busca artigos (?category_id=, ?query=)
GET    /kb-articles/{id}             → detalhe de um artigo
POST   /kb-articles                  → cria artigo — role=technician
PATCH  /kb-articles/{id}             → edita artigo (parcial) — role=technician

GET    /categories                   → lista categorias — role=technician/manager
POST   /categories                   → cria categoria (barra nome duplicado) — role=technician/manager
PATCH  /categories/{id}              → edita categoria (parcial) — role=technician/manager

GET    /services                     → lista serviços do catálogo
POST   /services                     → cria serviço — role=technician/manager
PATCH  /services/{id}                → edita serviço (parcial) — role=technician/manager

GET    /sla-rules                    → lista as 4 regras de SLA — role=technician/manager
PATCH  /sla-rules/{id}               → edita prazos (parcial; priority não editável) — role=technician/manager

GET    /business-hours               → lista os 7 dias do calendário — role=technician/manager
PATCH  /business-hours/{id}          → edita is_open/start_time/end_time — role=technician/manager

GET    /holidays                     → lista feriados — role=technician/manager
POST   /holidays                     → cria feriado (barra data duplicada) — role=technician/manager
DELETE /holidays/{id}                → remove feriado — role=technician/manager

GET    /users                        → lista usuários — role=admin
POST   /users                        → cria usuário (barra e-mail duplicado) — role=admin
PATCH  /users/{id}                   → edita usuário (parcial; só name/role) — role=admin

GET    /groups                       → lista grupos, com member_ids — role=admin
POST   /groups                       → cria grupo — role=admin
PATCH  /groups/{id}/members          → substitui o conjunto de membros por completo — role=admin

GET    /audit-log                    → lista a trilha de auditoria — role=admin

GET    /automation-rules             → lista a regra de automação (1 linha) — role=manager
PATCH  /automation-rules/{id}        → edita threshold_percent/enabled — role=manager
GET    /notifications                → lista chamados que dispararam a regra, calculado sob demanda — role=manager

GET    /monitoring/summary           → uptime + taxa de erro (?window_hours=, padrão 24) — role=manager
```

---

## 6. Integração com IA (fluxo de triagem)

```
[Novo chamado criado — texto livre ou via Catálogo de Serviços]
        ↓
[app/services/triage.py — modo live (Anthropic) se ANTHROPIC_API_KEY configurada, senão mock (heurística local)]
        ↓
[LLM/heurística recebe: título + descrição + nomes das categorias já cadastradas]
        ↓
[Retorna: severidade (→ priority) + categoria sugerida (casada por nome com as já cadastradas)]
        ↓
[Se category_id/priority vierem explícitos no payload (ou herdados de um serviço do catálogo), prevalecem sobre a sugestão — mas ai_suggested_* sempre preserva a sugestão pura da IA]
        ↓
[Ticket salvo com priority/category_id finais + ai_suggested_priority/ai_suggested_category_id]
        ↓
[Categoria final do ticket tem algum kb_article vinculado? → sugere na tela; "resolveu" → resolved_by_ai=true]
```

Ponto de atenção, o mais importante do projeto: salvar sempre o valor original sugerido pela IA (`ai_suggested_*`) separado do valor final (`priority`, `category_id`) — é o que permite medir o acerto da IA depois (dashboard: `ai_accuracy_priority`/`ai_accuracy_category`, sugerida vs. mantida/reclassificada). Sem isso, a métrica de acerto da IA não tem dado real.

**Simplificação de escopo confirmada:** a sugestão de artigo da KB é casada por `category_id` (categoria final do chamado bate com a categoria do artigo), **sem envolver a IA** na escolha do artigo em si — diferente da concepção inicial (IA devolvendo o artigo junto com categoria/prioridade). Decisão tomada pra não reabrir o serviço de triagem já fechado e testado; o ganho de sofisticação não pareceu valer o risco de regressão.

---

## 7. Navegação do frontend (rotas)

| Rota | Tela | Quem acessa |
|---|---|---|
| `/login` | Login | Todos (sem auth) |
| `/inicio` | Página inicial (hub com atalhos) | Todos |
| `/perfil` | Perfil (só leitura) | Todos |
| `/novo-chamado` | Novo chamado | end_user |
| `/catalogo` | Catálogo de Serviços | end_user |
| `/meus-chamados` | Meus chamados (do usuário final) | end_user |
| `/tickets/:id` | Detalhe do chamado (chrome varia por role) | Todos |
| `/meu-dashboard` | Dashboard pessoal | technician |
| `/meus-atendimentos` | Fila — meus chamados (do técnico) | technician |
| `/fila` | Fila geral — não atribuídos | technician (manager alcança via link do dashboard) |
| `/base-conhecimento` | Base de conhecimento | technician |
| `/preferencias` | Prioridades (filtro padrão de fila) | technician |
| `/agenda` | Agenda (chamados por vencimento de SLA) | technician |
| `/dashboard` | Dashboard do gestor | manager |
| `/relatorios` | Relatórios (CSV/PDF) | technician, manager |
| `/automacoes` | Automações | manager |
| `/monitoramento` | Monitoramento | manager |
| `/configuracoes` | Configurações (categorias, serviços, SLA, calendário) | technician, manager |
| `/admin` | Administração (usuários, grupos, auditoria) | admin |

Nem toda rota tem guard de redirect no frontend — as telas mais novas (Fase 14 em diante: dashboard do técnico, preferências, agenda, relatórios, automações, monitoramento, configurações, admin) redirecionam pro destino padrão do role (`homeRouteForRole`) quando acessadas pela persona errada; rotas mais antigas (`/fila`, `/meus-atendimentos`, telas do usuário final) não têm esse guard — não há link pra elas fora da persona certa, mas a URL funciona se acessada direto. Nesses casos sem guard, o **backend** também não restringe por role (`GET /tickets` é aberto a qualquer usuário autenticado, por decisão documentada em §5/§8) — então um usuário final que navegasse direto pra `/fila` conseguiria ver os chamados de todo mundo, não só os próprios. Característica conhecida do design atual (não é um bug), coerente com a decisão de manter os endpoints de tickets sem restrição de role; todo endpoint que expõe dado ou ação mais sensível (dashboards, configurações, administração, automações, monitoramento) tem `require_role` no **backend** — a barreira de verdade —, com ou sem o guard correspondente no frontend.

---

## 8. Decisões de escopo confirmadas (não reabrir sem motivo novo)

- **Permissões:** perfil fixo (`role`), sem RBAC granular configurável (Opção A).
- **Status de chamado:** enum fixo no código (`open`/`in_progress`/`resolved`/`closed`), não vira tabela configurável.
- **Multicanal:** entrada só via portal web + API — sem e-mail, chat, WhatsApp, telefone.
- **Automações:** notificação dentro do próprio sistema, sem e-mail/SMS; 1 regra fixa, sem motor de regras configurável; avaliação sob demanda, sem scheduler/job em background.
- **Monitoramento:** log persistido de requisições (não contador em memória) — decisão que aceita o custo de 1 `INSERT` por requisição real em troca de sobreviver a restart do backend.
- **CMDB/Problem Management:** sem CRUD dedicado — só o vínculo com chamados, pro dashboard.
- **Catálogo de Serviços:** sem formulário dinâmico por serviço — só nome/categoria/descrição.
- **IA:** classificação + roteamento por categoria + sugestão de KB por categoria (não pela IA escolhendo o artigo) — sem chatbot, análise de sentimento ou resumo executivo.
- **Mudança/Release Management:** fora de escopo — o domínio ITSM cobre só incidente, requisição, problema e catálogo de serviços.

---

## 9. Fora do escopo (Fase 18, futura)

RMM próprio integrado:
- Agente instalado no endpoint (heartbeat, inventário automático)
- Acesso remoto
- Patch management

`tickets.asset_id`/`assets` (CMDB, §4) já são a ponte de dados pra isso, se um dia entrar em escopo — não há nada preparado além disso de propósito (evita construir estrutura pra uma feature que pode nunca entrar).

---

## 10. Status atual

Todo o roadmap planejado está fechado: MVP original (Fases 1-9) + evolução pós-MVP (Fases 10-17, navegação completa inspirada em GLPI/ServiceNow). Só a Fase 18 (RMM próprio) segue em aberto, sem data — ver `CLAUDE.md` pra decisão de retomar ou não.

Para o histórico completo fase a fase — o que foi decidido, o que foi testado, achados durante o desenvolvimento — ver `CLAUDE.md` (seção "Status atual"), que é atualizado a cada fase fechada e é a fonte viva de verdade sobre o processo. Este documento é a referência do estado final, não do caminho até aqui.
