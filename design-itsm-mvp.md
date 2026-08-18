# Design do MVP — Sistema ITSM com IA de Triagem

> Projeto de portfólio. Fase 1: ITSM completo com IA nativa. Fase 2 (futura): RMM próprio integrado.

---

## 1. Visão geral

Sistema de chamados (ITSM) onde a IA de triagem — reaproveitando a lógica já validada no AIOps Copilot — participa desde a abertura do chamado, não como um recurso colado depois. Três personas, um fluxo, uma base de dados.

**Stack:** FastAPI (backend) + React (frontend) + PostgreSQL.

---

## 2. Personas e fluxos

### 2.1 Usuário final
1. Abre um chamado descrevendo o problema em texto livre
2. IA classifica categoria + prioridade automaticamente e sugere artigo da Knowledge Base
3. Se a sugestão resolve → usuário fecha o chamado sozinho (métrica: "resolvido por IA sem técnico")
4. Se não resolve → chamado entra na fila do técnico já triado

**Tela(s):** Nova solicitação (campo texto + upload opcional) → Tela de sugestão da IA (artigo + botão "resolveu"/"não resolveu") → Acompanhamento do chamado (status, histórico)

### 2.2 Técnico (N1/N2)
1. Vê fila de chamados já com severidade, causa provável e categoria pré-preenchidas pela IA
2. Pode aceitar a sugestão da IA ou reclassificar manualmente (esse dado retroalimenta a qualidade do modelo)
3. Atende, registra interações, resolve ou escala

**Tela(s):** Fila de chamados (lista priorizada) → Detalhe do chamado (histórico + sugestão da IA + campo de ação) → Base de conhecimento (busca/consulta)

### 2.3 Gestor/supervisor
1. Acompanha dashboard: volume de chamados, SLA estourado, top categorias, tempo médio de resolução
2. **Métrica central do diferencial:** % de chamados resolvidos sem intervenção humana + tempo médio de triagem (IA vs. manual)

**Tela(s):** Dashboard (gráficos) → Relatório de SLA → Relatório de impacto da IA

---

## 3. Modelo de dados (schema conceitual)

### `users`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| name | string | |
| email | string | único |
| role | enum | `end_user`, `technician`, `manager` |
| created_at | timestamp | |

### `tickets`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| title | string | |
| description | text | |
| status | enum | `open`, `in_progress`, `resolved`, `closed` |
| priority | enum | `low`, `medium`, `high`, `critical` — preenchido pela IA, editável |
| category_id | UUID | FK → categories |
| requester_id | UUID | FK → users |
| assignee_id | UUID | FK → users, nullable |
| ai_suggested_priority | enum | valor original da IA, preservado p/ métricas |
| ai_suggested_category_id | UUID | idem |
| resolved_by_ai | boolean | default false |
| sla_due_at | timestamp | calculado a partir da SLA rule |
| created_at / updated_at | timestamp | |

### `categories`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| name | string | |
| default_sla_hours | int | |

### `interactions`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| ticket_id | UUID | FK |
| author_id | UUID | FK → users |
| content | text | |
| created_at | timestamp | |

### `kb_articles`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| title | string | |
| content | text | |
| category_id | UUID | FK |
| times_suggested | int | contador — alimenta relatório de eficácia |

### `sla_rules`
| campo | tipo | obs |
|---|---|---|
| id | UUID | PK |
| priority | enum | |
| response_time_hours | int | |
| resolution_time_hours | int | |

---

## 4. Contrato de API (endpoints principais)

```
POST   /auth/login
POST   /tickets                     → cria chamado (dispara triagem IA automaticamente)
GET    /tickets                     → lista (com filtros: status, prioridade, assignee)
GET    /tickets/{id}                → detalhe + histórico de interações
PATCH  /tickets/{id}                → atualizar status/prioridade/assignee
POST   /tickets/{id}/interactions   → adicionar comentário/atualização
POST   /tickets/{id}/resolve-by-user → usuário marca como resolvido pela sugestão da IA

GET    /kb-articles?query=          → busca na base de conhecimento
GET    /kb-articles/{id}

GET    /dashboard/summary           → métricas gerais (volume, SLA, categorias)
GET    /dashboard/ai-impact         → % resolvido por IA, tempo médio de triagem
```

---

## 5. Integração com IA (fluxo de triagem)

```
[Novo chamado criado]
        ↓
[Endpoint chama serviço de triagem — reaproveita lógica do AIOps Copilot]
        ↓
[LLM recebe: título + descrição]
        ↓
[Retorna JSON estruturado: categoria, prioridade, causa provável, artigo KB sugerido]
        ↓
[Ticket é salvo já com esses campos preenchidos]
        ↓
[Se resolvido pelo usuário via sugestão → resolved_by_ai = true]
```

Ponto de atenção: salvar sempre o valor original sugerido pela IA (`ai_suggested_*`) separado do valor final (`priority`, `category_id`) — é o que permite medir acerto da IA depois (comparar sugestão vs. o que o técnico realmente definiu).

---

## 6. Fora do escopo do MVP (fase 2 — RMM)

- Agente instalado no endpoint (heartbeat, inventário)
- Acesso remoto
- Patch management
- Vínculo de ativos (`assets`) aos chamados

---

## Próximo passo sugerido

Com o desenho fechado, a ordem de execução recomendada é:
1. Modelo de dados + migrations (Postgres)
2. Endpoints core de `tickets` (CRUD) sem IA ainda — validar o fluxo básico primeiro
3. Plugar o serviço de triagem (reaproveitando o AIOps Copilot)
4. Frontend: fila do técnico → tela de novo chamado → dashboard do gestor (nessa ordem, pois a fila é o que valida o back mais rápido)
