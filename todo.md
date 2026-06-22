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

- [ ] Schema: adicionar campos `passwordHash`, `resetToken`, `resetTokenExpiresAt` na tabela users
- [ ] Migration SQL aplicada
- [ ] Backend: endpoint POST /api/auth/register (nome, email, senha)
- [ ] Backend: endpoint POST /api/auth/login (email, senha → JWT cookie)
- [ ] Backend: endpoint POST /api/auth/logout
- [ ] Backend: endpoint POST /api/auth/forgot-password (gera token)
- [ ] Backend: endpoint POST /api/auth/reset-password (valida token, redefine senha)
- [ ] Remover dependência do Manus OAuth do fluxo principal
- [ ] Tela de Login com email e senha
- [ ] Tela de Cadastro com nome, email e senha
- [ ] Tela de Recuperação de senha (solicitar)
- [ ] Tela de Redefinição de senha (com token)
- [ ] Painel de Admin: lista de usuários, data de cadastro, status
- [ ] Proteção de rotas: redirecionar para login se não autenticado
- [ ] Testes Vitest para register, login e logout
