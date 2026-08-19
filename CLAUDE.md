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

Próximo passo real: Fase 4, tela 2/3 — novo chamado.

Decisões já tomadas para a Fase 4 (não reabrir sem motivo):
- Frontend: Vite + React + TypeScript + React Router + Tailwind CSS.
- Sem tela de login "de verdade" por ora — um seletor simples de usuário/técnico no frontend, chamando `POST /auth/login` com credenciais de contas semeadas direto no banco.
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
