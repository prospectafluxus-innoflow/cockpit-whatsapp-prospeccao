# Cockpit de Prospecção WhatsApp — TODO

## Banco de Dados & Backend
- [x] Schema: tabela `leads` com campos nome, empresa, whatsapp, score, camada, status, toques
- [x] Schema: tabela `daily_sends` para controle do limite diário de 30 envios
- [x] Migration SQL aplicada via webdev_execute_sql
- [x] Router tRPC: leads.upload (importar planilha xlsx)
- [x] Router tRPC: leads.list (listar com filtros por camada, status, busca)
- [x] Router tRPC: leads.updateStatus (marcar Respondeu / Não respondeu / Descartado)
- [x] Router tRPC: leads.registerSend (registrar envio de toque, controle diário)
- [x] Router tRPC: leads.kanban (listar por colunas do Kanban)
- [x] Router tRPC: leads.moveKanban (mover lead entre colunas)
- [x] Router tRPC: leads.aiSuggestion (sugestão de resposta com IA)
- [x] Router tRPC: leads.exportCSV (exportar progresso)
- [x] Router tRPC: dashboard.metrics (métricas gerais)
- [x] Lógica de liberação automática de toques (3 dias Toque 2, 4 dias Toque 3)

## Interface — Layout & Navegação
- [x] Tema dark elegante com paleta refinada (CSS variables)
- [x] Fontes Google: Inter + JetBrains Mono
- [x] DashboardLayout com sidebar: Cockpit, Kanban, Dashboard
- [x] Barra de progresso de envios diários no header (limite 30)
- [x] Alerta visual progressivo ao se aproximar do limite diário

## Interface — Cockpit de Prospecção
- [x] Upload de planilha .xlsx com mapeamento automático de colunas
- [x] Visualização de leads por camadas A, B, C com chips/filtros
- [x] Busca por nome ou empresa
- [x] Card de lead com: nome, empresa, score, camada, status atual, toques
- [x] Botão "Enviar Toque X" que abre wa.me com mensagem pré-preenchida
- [x] Botões de status: "Respondeu", "Não respondeu", "Descartado"
- [x] Indicador visual de toque sugerido (próximo a enviar)
- [x] Contador de envios do dia no topo

## Interface — Dashboard de Métricas
- [x] Total de leads por camada
- [x] Enviados hoje vs limite (30)
- [x] Taxa de resposta por camada (gráfico)
- [x] Progresso dos ciclos (quantos em Toque 1, 2, 3)
- [x] Leads descartados e fechados

## Interface — CRM Kanban
- [x] Colunas: Novo, Toque 1 Enviado, Toque 2 Enviado, Toque 3 Enviado, Respondeu, Fechado
- [x] Cards arrastáveis entre colunas
- [x] Contagem de leads por coluna
- [x] Card com nome, empresa, camada e score

## Interface — Sugestão de Resposta com IA
- [x] Modal ao marcar "Respondeu" com sugestão de follow-up personalizada
- [x] Sugestão baseada no perfil do lead (nome, empresa, camada, score)
- [x] Botão para copiar mensagem sugerida
- [x] Botão para abrir wa.me com a mensagem sugerida

## Exportação & Persistência
- [x] Exportação do progresso em CSV
- [x] Persistência por usuário autenticado (isolamento de dados)

## Testes
- [x] Vitest: teste do router de leads (14 testes passando)
- [x] Vitest: teste da lógica de liberação de toques

## Agendamento Inteligente de Lembretes
- [x] Schema: tabela `send_schedules` com configuração de janelas de horário por usuário
- [x] Migration SQL aplicada para a nova tabela
- [x] Router tRPC: schedule.get (buscar configuração atual)
- [x] Router tRPC: schedule.save (salvar/atualizar configuração de janelas)
- [x] Router tRPC: schedule.getQueue (retornar fila sugerida por janela do dia)
- [x] Handler Heartbeat: /api/scheduled/send-reminder (envia notificação ao usuário)
- [x] Lógica de seleção inteligente de leads por janela (prioridade: camada A > B > C, toque mais urgente primeiro)
- [x] Página de Agendamento com configuração de horários e preview da fila
- [x] Seção "Fila do Dia" no Cockpit mostrando os leads sugeridos para cada janela
- [x] Ativação/desativação do agendamento por janela
- [x] Indicador visual de qual janela está ativa no momento

## Autenticação Própria (Email + Senha)

- [x] Schema: adicionar campos `passwordHash`, `resetToken`, `resetTokenExpiresAt` na tabela users
- [x] Migration SQL aplicada
- [x] Backend: endpoint POST /api/auth/register (nome, email, senha)
- [x] Backend: endpoint POST /api/auth/login (email, senha → JWT cookie)
- [x] Backend: endpoint POST /api/auth/logout
- [x] Backend: endpoint POST /api/auth/forgot-password (gera token)
- [x] Backend: endpoint POST /api/auth/reset-password (valida token, redefine senha)
- [x] Remover dependência do Manus OAuth do fluxo principal
- [x] Tela de Login com email e senha
- [x] Tela de Cadastro com nome, email e senha
- [x] Tela de Recuperação de senha (solicitar)
- [x] Tela de Redefinição de senha (com token)
- [x] Painel de Admin: lista de usuários, data de cadastro, status
- [x] Proteção de rotas: redirecionar para login se não autenticado
- [x] Testes Vitest para register, login e logout

## Migração para Deploy Independente (Supabase + Render + OpenRouter)

- [x] Schema PostgreSQL: converter MySQL → PostgreSQL (drizzle dialect, tipos, enums)
- [x] Conexão com banco via postgres.js (compatível com Supabase)
- [x] drizzle.config.ts: atualizado para dialect "postgresql"
- [x] IA: substituir LLM Manus por OpenRouter (fetch nativo, sem SDK, funciona no Brasil)
- [x] Heartbeat: stub independente do Manus Forge (modo simulado quando FORGE não disponível)
- [x] Notificações: substituir Forge por console.log + Resend opcional
- [x] env.ts: adicionar OPENROUTER_API_KEY, CRON_SECRET
- [x] Endpoint /api/cron/send-reminder para Render Cron Jobs
- [x] cronHandler.ts: handler do endpoint de cron independente
- [x] render.yaml: configuração de deploy no Render (web service + 3 cron jobs)
- [x] scripts/migrate.mjs: script de criação das tabelas no Supabase
- [x] env.example.txt: template de variáveis de ambiente
- [x] package.json: scripts build:prod, start:prod, db:migrate, db:generate
- [x] CockpitPage: linha do tempo de toques com datas nos cards
- [x] CockpitPage: import de planilha corrigido (suporte a "Camada A — ICP" com travessão)
- [x] authOwn.test.ts: corrigir mock do db (remover getDb obsoleto)
- [x] Todos os testes: 24 passando, 0 erros TypeScript
- [x] Configurar GEMINI_API_KEY no projeto (via webdev_request_secrets)
- [x] Configurar CRON_SECRET no projeto (definido via Cloud Run no deploy)
- [x] Salvar checkpoint final e preparar guia de deploy

## 4ª Janela de Envio: Meio da tarde (afternoon)

- [x] Schema: adicionar colunas `afternoonEnabled`, `afternoonHour`, `afternoonCount`, `afternoonTaskUid` na tabela send_schedules
- [x] db.ts: atualizar getScheduleByTaskUid para incluir afternoonTaskUid
- [x] db.ts: atualizar getDistributedQueueForDay para aceitar 5 parâmetros e retornar afternoon
- [x] routers.ts: adicionar afternoon a schedule.get, schedule.getQueue, schedule.save e schedule.activate
- [x] cronHandler.ts: adicionar "afternoon" como janela válida
- [x] scheduleHandler.ts: adicionar "afternoon" como janela válida
- [x] SchedulePage.tsx: adicionar janela "Meio da tarde" com ícone Cloud (sky-400)
- [x] CockpitPage.tsx: adicionar janela "Meio da tarde" na Fila do Dia (grid 2x2 → 4 colunas)
- [x] SQL migration: script criado em scripts/migrate-afternoon.mjs (executar no Supabase SQL Editor)
- [x] Deploy: checkpoint salvo → push automático para GitHub → Railway auto-deploy via git push

## Sistema de Aprovação de Cadastro

- [x] Schema: enum `approval_status` (pending/approved/rejected) + coluna `approvalStatus` na tabela users
- [x] authOwn.ts: registro cria usuário com `pending`, sem cookie de sessão
- [x] authOwn.ts: login bloqueia usuários `pending` e `rejected` com mensagem específica
- [x] authOwn.ts: procedures `approveUser` e `rejectUser` para admin
- [x] authOwn.ts: `listUsers` retorna campo `approvalStatus`
- [x] RegisterPage: tela de "Aguardando aprovação" após cadastro bem-sucedido
- [x] LoginPage: alertas visuais amber (pending) e vermelho (rejected)
- [x] AdminPage: contador de pendentes, botões Aprovar/Rejeitar/Revogar por usuário
- [ ] SQL migration: executar no Supabase (ver SQL abaixo)
