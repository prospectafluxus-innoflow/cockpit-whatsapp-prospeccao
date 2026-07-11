# ProspectaFluxus no Railway — atualização segura

Este documento descreve a atualização de uma instalação existente do ProspectaFluxus no Railway. O deploy de produção só deve ocorrer depois de a branch ter sido revista, os testes estarem aprovados e existir um backup recente do PostgreSQL.

> **Aviso de segurança:** o repositório esteve público e continha valores sensíveis em documentação antiga. Antes do próximo deploy, revogue e recrie a palavra-passe do PostgreSQL, a chave Gemini, `JWT_SECRET` e `CRON_SECRET`. Tornar o repositório privado novamente não invalida credenciais que já tenham sido expostas.

## 1. Preparação

Trabalhe sempre numa branch separada. Confirme que o Railway acompanha apenas a branch de produção e que um push na branch de revisão não inicia um deploy automático.

| Verificação | Critério de aprovação |
|---|---|
| Backup | Snapshot ou backup exportável do PostgreSQL concluído |
| Instalação | `pnpm install --frozen-lockfile` concluído |
| Tipos | `pnpm check` sem erros |
| Testes | `pnpm test` sem falhas |
| Build | `pnpm build:prod` concluído |
| Segurança | Auditoria de dependências sem avisos críticos ou altos |

## 2. Variáveis obrigatórias no Railway

Configure os valores em **Service → Variables**. Nunca coloque valores reais em ficheiros versionados.

| Variável | Finalidade | Como gerar ou obter |
|---|---|---|
| `NODE_ENV` | Execução de produção | `production` |
| `PORT` | Porta da aplicação | `3000` ou a porta fornecida pelo Railway |
| `DATABASE_URL` | PostgreSQL | Nova connection string do Supabase/PostgreSQL |
| `JWT_SECRET` | Sessões | `openssl rand -base64 48` |
| `CRON_SECRET` | Proteção do endpoint de lembretes | Gere outro valor com `openssl rand -base64 48` |
| `VAPID_PUBLIC_KEY` | Web Push no navegador | Par gerado por `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Assinatura Web Push no servidor | Chave privada do mesmo par VAPID |
| `VAPID_SUBJECT` | Contacto do emissor Web Push | `mailto:SEU_EMAIL_DE_SUPORTE` |
| `INTEGRATION_ENCRYPTION_KEY` | Cifragem das credenciais Trello | `openssl rand -hex 32` |

`INTEGRATION_ENCRYPTION_KEY` deve permanecer estável. Se for alterada depois de o Trello ser configurado, cada utilizador terá de ligar novamente a integração.

## 3. Armazenamento privado dos áudios

No Railway, configure um bucket S3, Cloudflare R2 ou outro serviço compatível com S3. O bucket deve permanecer privado; a aplicação entrega URLs temporárias apenas a utilizadores autenticados.

| Variável | Valor esperado |
|---|---|
| `S3_BUCKET` | Nome do bucket privado |
| `S3_REGION` | Região do serviço; use `auto` quando o fornecedor indicar |
| `S3_ENDPOINT` | Endpoint HTTPS do fornecedor, se não for AWS S3 |
| `S3_ACCESS_KEY_ID` | Identificador de acesso com permissão restrita ao bucket |
| `S3_SECRET_ACCESS_KEY` | Segredo correspondente |
| `S3_FORCE_PATH_STYLE` | `true` apenas quando exigido pelo fornecedor |

A infraestrutura integrada legada também é suportada por `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY`. Não configure os dois modos ao mesmo tempo; quando as variáveis integradas existem, elas têm prioridade.

## 4. Variáveis opcionais

| Variável | Finalidade |
|---|---|
| `GEMINI_API_KEY` | Sugestões de follow-up por IA |
| `OPENROUTER_API_KEY` | Alternativa de IA, quando usada |
| `RESEND_API_KEY` | Lembretes adicionais por email |
| `NOTIFICATION_EMAIL` | Destinatário do email de lembrete |

## 5. Migrações do banco

As migrações são aditivas e foram validadas numa base PostgreSQL descartável. Aplique-as **uma única vez antes de iniciar a nova versão**:

```bash
pnpm db:migrate
```

O comando utiliza `DATABASE_URL` e o histórico em `drizzle/`. Não use `scripts/migrate.mjs` para esta atualização: esse ficheiro é legado e não contém as tabelas e colunas dos novos módulos.

Depois da execução, confirme a existência das seguintes alterações:

| Objeto | Resultado esperado |
|---|---|
| `message_templates` | Metadados opcionais do áudio |
| `push_subscriptions` | Dispositivos Web Push por utilizador |
| `trello_integrations` | Configuração Trello cifrada por utilizador |
| `leads` | Estado e identificador de sincronização Trello |

## 6. Build e início

O `railway.json` usa:

```text
Build: pnpm run build:prod
Start: node dist/index.js
```

A aplicação deve responder normalmente antes de ativar integrações na interface. Se o deploy falhar, não repita migrações manualmente sem primeiro consultar os logs.

## 7. Alertas Web Push

Mantenha os três agendamentos do Railway apontados para:

```text
POST /api/cron/send-reminder
```

Envie o segredo no cabeçalho `x-cron-secret`. O corpo deve usar um dos períodos aceites pela aplicação: `morning`, `afternoon` ou `evening`.

```bash
curl -X POST "https://SEU_DOMINIO/api/cron/send-reminder" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: SUBSTITUA_PELO_CRON_SECRET" \
  -d '{"period":"morning"}'
```

No iPhone, o utilizador deve instalar o ProspectaFluxus no ecrã principal pelo Safari e só então ativar os alertas no Perfil. No Android e no computador, a ativação pode ser feita diretamente num navegador compatível.

## 8. Trello

A configuração é feita em **Perfil → Integração Trello**. A API key e o token são enviados somente ao backend e armazenados cifrados. O cartão é criado apenas quando o lead entra em **Respondeu**. A sincronização é idempotente e um botão de reintento aparece no Kanban quando o Trello estiver temporariamente indisponível.

## 9. Áudio por toque

O áudio é configurado junto de cada template de toque. A aplicação aceita os formatos indicados na interface, valida o tamanho antes do upload e mantém o ficheiro num bucket privado. No telemóvel, usa a partilha nativa; no computador, oferece download e abre o contacto do WhatsApp como alternativa assistida.

## 10. Verificação pós-deploy

Execute a verificação com uma conta de teste e dados não sensíveis.

| Teste | Resultado esperado |
|---|---|
| Login e cockpit | Acesso normal e filas preservadas |
| Importação Excel | Ficheiro válido importado sem regressão |
| Áudio | Upload, reprodução, substituição, remoção e partilha funcionam |
| Web Push | Ativação e notificação de teste chegam ao dispositivo |
| Agendamento | Um período de teste dispara apenas para a conta correta |
| Trello | Teste da lista aprovado e um lead respondido cria somente um cartão |
| Reintento Trello | Falha temporária não reverte o estado local do lead |

## 11. Rollback

Se a nova versão apresentar erro funcional, faça rollback do serviço para o deploy anterior no Railway. As migrações são aditivas; as colunas e tabelas novas podem permanecer sem afetar a versão anterior. Não apague dados ou tabelas durante um incidente.

Depois do rollback, registe o erro, preserve os logs e corrija-o numa nova branch. Altere ou elimine dados somente depois de um backup adicional e de uma análise específica.
