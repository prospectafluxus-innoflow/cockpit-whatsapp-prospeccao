# Caderno Técnico — ProspectaFluxus

**Cockpit de Prospecção WhatsApp — Documentação Técnica**
Versão 2.0 — Junho de 2026

---

## Sumário

1. [Arquitetura Geral](#1-arquitetura-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Infraestrutura e Hospedagem](#3-infraestrutura-e-hospedagem)
4. [Banco de Dados](#4-banco-de-dados)
5. [Autenticação](#5-autenticação)
6. [Módulos do Backend](#6-módulos-do-backend)
7. [Módulos do Frontend](#7-módulos-do-frontend)
8. [Importação de Planilha](#8-importação-de-planilha)
9. [Sistema de Toques e Mensagens](#9-sistema-de-toques-e-mensagens)
10. [Templates de Mensagem Personalizáveis](#10-templates-de-mensagem-personalizáveis)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Scripts de Migração](#12-scripts-de-migração)
13. [Histórico de Mudanças](#13-histórico-de-mudanças)

---

## 1. Arquitetura Geral

O ProspectaFluxus é uma aplicação web **full-stack monolítica** composta por um servidor Node.js (Express + tRPC) que serve tanto a API quanto os arquivos estáticos do frontend React. O banco de dados é PostgreSQL hospedado no Supabase. O sistema é **100% autônomo** — não depende de nenhum serviço externo além do Railway (hospedagem) e Supabase (banco de dados).

```
┌─────────────────────────────────────────────────┐
│                  Railway (Cloud Run)             │
│                                                  │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │  React 19    │    │  Express 4 + tRPC 11 │   │
│  │  (Vite build)│◄──►│  server/_core/       │   │
│  └──────────────┘    └──────────┬───────────┘   │
│                                 │               │
└─────────────────────────────────┼───────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │  Supabase (PostgreSQL)      │
                    │  aws-1-us-west-2.pooler     │
                    └────────────────────────────┘
```

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 22.x |
| Framework backend | Express | 4.x |
| API layer | tRPC | 11.x |
| ORM | Drizzle ORM | latest |
| Banco de dados | PostgreSQL (Supabase) | 15.x |
| Framework frontend | React | 19.x |
| Build tool | Vite | 6.x |
| Estilização | Tailwind CSS | 4.x |
| Componentes UI | shadcn/ui | latest |
| Gerenciador de pacotes | pnpm | 9.x |
| Linguagem | TypeScript | 5.x |
| Hash de senha | bcryptjs | 2.x |
| JWT | jsonwebtoken | 9.x |

---

## 3. Infraestrutura e Hospedagem

### Railway

O projeto é hospedado no Railway em modo **Autoscale** (serverless). O deploy é feito automaticamente via GitHub — qualquer push na branch `main` aciona um novo deploy.

- **URL de produção:** `prospectafluxus-production.up.railway.app`
- **Porta:** definida pela variável `PORT` do Railway (não hardcoded)
- **Comando de start:** `node dist/index.js`
- **Comando de build:** `pnpm build`

### Supabase

O banco de dados PostgreSQL está hospedado no Supabase com connection pooler ativado (modo `pooler` para compatibilidade com serverless).

- **Connection string:** variável `DATABASE_URL` no Railway
- **Host:** `aws-1-us-west-2.pooler.supabase.com`

### Configuração do `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

> **Atenção:** o comando de migração (`node scripts/migrate.mjs`) **não deve** ser incluído no `startCommand` do Railway, pois o healthcheck tem timeout de ~5 minutos e a migração pode exceder esse tempo em conexões lentas. Execute as migrações manualmente via Supabase SQL Editor.

---

## 4. Banco de Dados

### Tabelas

#### `users`

Armazena os usuários do sistema.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | serial PK | ID numérico único |
| `openId` | varchar(64) | ID OAuth externo (legado, não usado) |
| `name` | text | Nome completo |
| `email` | varchar(320) | E-mail único |
| `loginMethod` | varchar(64) | Método de login (`own` para email+senha) |
| `role` | enum | `user` ou `admin` |
| `approvalStatus` | enum | `pending`, `approved`, `rejected` |
| `whatsappOwn` | varchar(30) | WhatsApp do próprio usuário (lembretes) |
| `passwordHash` | varchar(255) | Hash bcrypt da senha |
| `resetToken` | varchar(128) | Token para redefinição de senha |
| `resetTokenExpiresAt` | timestamp | Expiração do token de reset |
| `createdAt` | timestamp | Data de criação |
| `updatedAt` | timestamp | Última atualização |
| `lastSignedIn` | timestamp | Último login |

#### `leads`

Armazena os leads importados da planilha.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | serial PK | ID único |
| `userId` | integer | FK para `users.id` |
| `name` | varchar(255) | Nome completo do lead |
| `firstName` | varchar(100) | Primeiro nome (extraído automaticamente) |
| `company` | varchar(255) | Nome da empresa |
| `whatsapp` | varchar(30) | Número WhatsApp (obrigatório) |
| `score` | integer | Score de prioridade |
| `layer` | enum | `A`, `B` ou `C` |
| `size` | varchar(100) | Porte da empresa |
| `employees` | integer | Número de funcionários |
| `investment` | varchar(100) | Faixa de investimento |
| `taxRegime` | varchar(100) | Regime tributário |
| `participations` | integer | Número de participações em eventos |
| `lastEvent` | varchar(100) | Último evento participado |
| `status` | enum | `novo`, `toque1_enviado`, `toque2_enviado`, `toque3_enviado`, `respondeu`, `fechado`, `descartado` |
| `kanbanColumn` | enum | Coluna atual no Kanban CRM |
| `toque1SentAt` | timestamp | Data/hora do Toque 1 |
| `toque2SentAt` | timestamp | Data/hora do Toque 2 |
| `toque3SentAt` | timestamp | Data/hora do Toque 3 |
| `respondedAt` | timestamp | Data/hora da resposta |
| `notes` | text | Notas manuais |
| `lastAiSuggestion` | text | Última sugestão gerada por IA |
| `createdAt` | timestamp | Data de criação |
| `updatedAt` | timestamp | Última atualização |

#### `daily_sends`

Registra cada toque enviado por dia, para controle do limite diário.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | serial PK | ID único |
| `userId` | integer | FK para `users.id` |
| `leadId` | integer | FK para `leads.id` |
| `touchNumber` | integer | Número do toque (1, 2 ou 3) |
| `sentDate` | date | Data do envio |
| `createdAt` | timestamp | Data de criação |

#### `send_schedules`

Configuração das janelas de horário por usuário.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | serial PK | ID único |
| `userId` | integer | FK para `users.id` (único por usuário) |
| `morningEnabled` | integer | Janela Manhã ativa (0/1) |
| `morningHour` | integer | Hora da janela Manhã (padrão: 8) |
| `morningCount` | integer | Leads na janela Manhã (padrão: 2) |
| `lunchEnabled` | integer | Janela Almoço ativa (0/1) |
| `lunchHour` | integer | Hora da janela Almoço (padrão: 12) |
| `lunchCount` | integer | Leads na janela Almoço (padrão: 2) |
| `afternoonEnabled` | integer | Janela Meio da tarde ativa (0/1) |
| `afternoonHour` | integer | Hora da janela Meio da tarde (padrão: 15) |
| `afternoonCount` | integer | Leads na janela Meio da tarde (padrão: 2) |
| `eveningEnabled` | integer | Janela Fim do dia ativa (0/1) |
| `eveningHour` | integer | Hora da janela Fim do dia (padrão: 17) |
| `eveningCount` | integer | Leads na janela Fim do dia (padrão: 2) |
| `morningTaskUid` | varchar(65) | UID da tarefa agendada (Manhã) |
| `lunchTaskUid` | varchar(65) | UID da tarefa agendada (Almoço) |
| `afternoonTaskUid` | varchar(65) | UID da tarefa agendada (Tarde) |
| `eveningTaskUid` | varchar(65) | UID da tarefa agendada (Noite) |

#### `message_templates`

Templates de mensagem personalizáveis por usuário.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | serial PK | ID único |
| `userId` | integer | FK para `users.id` |
| `toque` | integer | Número do toque (1, 2 ou 3) |
| `text` | text | Texto da mensagem com variáveis |
| `createdAt` | timestamp | Data de criação |
| `updatedAt` | timestamp | Última atualização |

> **SQL de criação manual** (caso a tabela não exista no banco):
> ```sql
> CREATE TABLE IF NOT EXISTS "message_templates" (
>   "id" serial PRIMARY KEY NOT NULL,
>   "userId" integer NOT NULL,
>   "toque" integer NOT NULL,
>   "text" text NOT NULL,
>   "createdAt" timestamp DEFAULT now() NOT NULL,
>   "updatedAt" timestamp DEFAULT now() NOT NULL
> );
> ```

---

## 5. Autenticação

### Fluxo de autenticação própria (email + senha)

O sistema usa autenticação **100% própria**, sem dependência de OAuth externo. O fluxo é:

1. O usuário envia `email` + `password` para `trpc.authOwn.login`.
2. O servidor busca o usuário pelo e-mail no banco.
3. Verifica o status de aprovação (`approvalStatus === 'approved'`).
4. Compara a senha com o hash bcrypt armazenado (`bcrypt.compare`).
5. Gera um JWT assinado com `JWT_SECRET` contendo `{ sub: userId, role }`.
6. Define o cookie `session` com `httpOnly: true`, `secure: true` (em produção), `sameSite: 'lax'`.

### Verificação de sessão

A cada requisição, o `server/_core/sdk.ts` (`authenticateRequest`) verifica:

1. Extrai o cookie `session` da requisição.
2. Verifica o JWT com `JWT_SECRET`.
3. Se o `sub` for numérico, busca o usuário no banco pelo ID.
4. Se `OAUTH_SERVER_URL` estiver vazio ou ausente, **não tenta fallback OAuth** — retorna `null` diretamente.

### Configuração do Express para proxy

O servidor usa `app.set('trust proxy', 1)` para que `req.protocol` reflita corretamente o HTTPS do Railway (que usa proxy reverso). Sem isso, o cookie seria criado sem a flag `Secure` e o navegador o rejeitaria.

### Roles e aprovação

- Novos usuários são criados com `role: 'user'` e `approvalStatus: 'pending'`.
- Um admin precisa aprovar o acesso na página de Administração.
- Procedures protegidas usam `protectedProcedure` (requer sessão válida).
- Procedures de admin usam verificação manual de `ctx.user.role === 'admin'`.

---

## 6. Módulos do Backend

### `server/routers.ts`

Arquivo principal de procedures tRPC. Organizado nos seguintes routers:

| Router | Procedures | Descrição |
|---|---|---|
| `authOwn` | `login`, `logout`, `me`, `register`, `approve`, `reject`, `listUsers` | Autenticação e gestão de usuários |
| `leads` | `list`, `upload`, `updateStatus`, `updateKanban`, `discard`, `addNote` | Gestão de leads |
| `schedule` | `get`, `save`, `activate`, `deactivate` | Configuração de agendamento |
| `dashboard` | `stats` | Métricas e estatísticas |
| `messageTemplates` | `get`, `save` | Templates de mensagem |
| `system` | `notifyOwner` | Notificações para o dono |

### `server/db.ts`

Helpers de banco de dados. Funções principais:

- `getUserById(id)` — busca usuário por ID
- `getUserByEmail(email)` — busca usuário por e-mail
- `getLeadsByUser(userId)` — retorna todos os leads de um usuário
- `insertLeads(userId, leads[])` — insere leads em lote (sem `.returning()` para performance)
- `deleteLeadsByUser(userId)` — remove todos os leads de um usuário
- `getMessageTemplates(userId)` — retorna templates ou padrões se não existirem
- `saveMessageTemplate(userId, toque, text)` — cria ou atualiza um template (upsert)

### `server/_core/sdk.ts`

Módulo de autenticação. Função `authenticateRequest(req)`:

- Lê o cookie `session`
- Verifica o JWT com `getSessionSecret()` (usa `JWT_SECRET`)
- Se `sub` for numérico, busca o usuário no banco
- Se `OAUTH_SERVER_URL` estiver vazio, **não tenta OAuth** (autonomia total)

### `server/_core/cookies.ts`

Gerencia a criação e leitura de cookies de sessão. Em produção (`NODE_ENV === 'production'`), sempre define `secure: true` independente do `req.protocol`, garantindo compatibilidade com o proxy do Railway.

---

## 7. Módulos do Frontend

### Páginas principais

| Arquivo | Rota | Descrição |
|---|---|---|
| `pages/LoginPage.tsx` | `/login` | Tela de login com email+senha |
| `pages/CockpitPage.tsx` | `/` | Cockpit principal de prospecção |
| `pages/KanbanPage.tsx` | `/kanban` | Kanban CRM |
| `pages/DashboardPage.tsx` | `/dashboard` | Métricas e estatísticas |
| `pages/SchedulePage.tsx` | `/agendamento` | Configuração de agendamento e templates |
| `pages/AdminPage.tsx` | `/admin` | Administração de usuários |

### Componentes relevantes

- `DashboardLayout.tsx` — layout com sidebar, autenticação e perfil do usuário
- `AIChatBox.tsx` — chat com IA integrado (disponível mas não ativado por padrão)

---

## 8. Importação de Planilha

### Fluxo técnico

1. O usuário seleciona o arquivo `.xlsx` no frontend.
2. O frontend usa `xlsx` (SheetJS) para parsear o arquivo localmente.
3. Os leads são filtrados: apenas linhas com `whatsapp` válido são mantidas.
4. Os leads são divididos em **lotes de 50** (`CHUNK_SIZE = 50`).
5. Para cada lote, o frontend chama `trpc.leads.upload` via `utils.client.leads.upload.mutate()`.
6. A barra de progresso é atualizada a cada lote concluído.
7. No servidor, `deleteLeadsByUser(userId)` é chamado apenas no **primeiro lote** (`replaceAll: true`).
8. Os lotes subsequentes fazem apenas `insertLeads` sem deletar.

### Por que lotes de 50?

Lotes maiores (150+) causavam timeout no Railway (180s por requisição). Com 50 leads por lote, cada requisição leva ~1-3 segundos, bem dentro do limite.

### Mapeamento de colunas da planilha

O frontend aceita variações de nome de coluna (case-insensitive):

| Campo interno | Colunas aceitas na planilha |
|---|---|
| `name` | `nome`, `name` |
| `company` | `empresa`, `company` |
| `whatsapp` | `whatsapp`, `telefone`, `celular`, `phone` |
| `layer` | `camada`, `layer` |
| `score` | `score`, `pontuação` |
| `segment` | `segmento`, `segment` |
| `size` | `porte`, `size` |

---

## 9. Sistema de Toques e Mensagens

### Geração do link WhatsApp

A função `buildWaLink(lead, toque, templates)` no `server/routers.ts`:

1. Seleciona o template do toque (1, 2 ou 3) — personalizado ou padrão.
2. Substitui `{firstName}` pelo primeiro nome do lead.
3. Substitui `{company}` pelo nome da empresa do lead.
4. Codifica o texto com `encodeURIComponent`.
5. Retorna `https://wa.me/${whatsapp}?text=${encodedText}`.

### Controle de limite diário

A função `canSendToque(userId, leadId, touchNumber, today)` verifica se o lead já recebeu aquele toque hoje, consultando a tabela `daily_sends`. O limite é de **30 toques por dia** por usuário.

### Atualização de status

Quando o usuário clica em "Enviar Toque X", o frontend chama `trpc.leads.updateStatus` que:

1. Atualiza `leads.status` para `toque{N}_enviado`.
2. Atualiza `leads.kanbanColumn` para `Toque N Enviado`.
3. Registra o timestamp `toque{N}SentAt`.
4. Insere um registro em `daily_sends`.

---

## 10. Templates de Mensagem Personalizáveis

### Funcionamento

Os templates são armazenados na tabela `message_templates` com `userId` e `toque` (1, 2 ou 3). Quando o usuário salva um template na página de Agendamento, o sistema faz um **upsert** (cria se não existe, atualiza se já existe).

### Textos padrão (fallback)

Se o usuário não tiver templates salvos, ou se a tabela `message_templates` não existir no banco (tratado com try/catch), o sistema usa os textos padrão definidos em `server/db.ts` na constante `DEFAULT_TEMPLATES`. Esses textos já contêm as variáveis `{firstName}` e `{company}`.

### Variáveis disponíveis

| Variável | Substituído por |
|---|---|
| `{firstName}` | Primeiro nome do lead |
| `{company}` | Nome da empresa do lead |

### Procedure `messageTemplates.get`

Retorna os 3 templates do usuário. Se a tabela não existir (banco sem migração), retorna os padrões sem lançar erro.

### Procedure `messageTemplates.save`

Recebe `{ toque: 1|2|3, text: string }` e faz upsert na tabela. Requer sessão autenticada.

---

## 11. Variáveis de Ambiente

Todas as variáveis são configuradas no painel **Variables** do Railway.

| Variável | Obrigatório | Descrição |
|---|---|---|
| `DATABASE_URL` | **Sim** | Connection string do Supabase PostgreSQL |
| `JWT_SECRET` | **Sim** | Chave secreta para assinar JWTs de sessão |
| `NODE_ENV` | **Sim** | `production` em produção |
| `OAUTH_SERVER_URL` | Não | Pode ficar vazio — o sistema não usa OAuth externo |
| `BUILT_IN_FORGE_API_KEY` | Não | Chave da API Manus (para funcionalidades de IA) |
| `BUILT_IN_FORGE_API_URL` | Não | URL da API Manus |
| `VITE_APP_ID` | Não | ID do app Manus (legado) |
| `OWNER_OPEN_ID` | Não | Open ID do dono (legado) |
| `GEMINI_API_KEY` | Não | Chave Gemini (para funcionalidades de IA) |
| `CRON_SECRET` | Não | Secret para autenticar chamadas de cron externo |

> **Importante:** `OAUTH_SERVER_URL` pode ser deixado como string vazia. O sistema detecta isso e não tenta autenticação OAuth, usando apenas o JWT local.

---

## 12. Scripts de Migração

### `scripts/migrate.mjs`

Script de migração que cria todas as tabelas necessárias no banco de dados. **Deve ser executado manualmente** no Supabase SQL Editor ou via `node scripts/migrate.mjs` localmente com `DATABASE_URL` configurado.

Tabelas criadas pelo script:
- `users` (com enums `role` e `approval_status`)
- `leads` (com enums `layer`, `status`, `kanban_column`)
- `daily_sends`
- `send_schedules`
- `message_templates`

> **Não inclua o migrate no `startCommand` do Railway** — o healthcheck tem timeout de ~5 minutos e o migrate pode excedê-lo em conexões lentas ao Supabase.

---

## 13. Histórico de Mudanças

### v2.0 — Junho de 2026

**Autenticação autônoma**
- Removida dependência do Manus OAuth (`OAUTH_SERVER_URL`)
- `sdk.ts` modificado: se `OAUTH_SERVER_URL` estiver vazio, não tenta fallback OAuth
- `cookies.ts` modificado: em produção, `secure: true` sempre (independente de `req.protocol`)
- `server/_core/index.ts`: adicionado `app.set('trust proxy', 1)` para compatibilidade com proxy do Railway

**Importação de planilha**
- Lote reduzido de 150 para **50 leads** por requisição (evita timeout no Railway)
- Removido `.returning()` do `insertLeads` (melhora performance no servidor)
- Adicionada **barra de progresso visual** com contador `X / Y` durante importação

**Templates de mensagem personalizáveis**
- Nova tabela `message_templates` no schema
- Procedures `messageTemplates.get` e `messageTemplates.save`
- Seção "Mensagens dos Toques" na página de Agendamento
- Textos padrão atualizados com mensagens reais da InnoFlow
- Try/catch defensivo: se tabela não existir, usa textos padrão sem quebrar

**Correções de bugs**
- Fix: leads não apareciam no Cockpit após relogin (causa: cookie sem flag `Secure` por falta de `trust proxy`)
- Fix: `railway.json` revertido para `startCommand` simples (sem migrate, que causava healthcheck failure)

### v1.0 — Maio de 2026

- Versão inicial com Cockpit, Kanban CRM, Dashboard, Agendamento e Administração
- Autenticação via Manus OAuth
- Importação de planilha em lotes de 150 leads

---

*Documentação técnica elaborada para uso interno da InnoFlow — ProspectaFluxus v2.0*
