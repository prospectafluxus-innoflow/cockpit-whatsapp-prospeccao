# ProspectaFluxus — Caderno Técnico

**Cockpit de Prospecção WhatsApp**

**Versão 3.0 — 11 de julho de 2026**

## Sumário

1. [Arquitetura](#1-arquitetura)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Infraestrutura](#3-infraestrutura)
4. [Modelo de dados](#4-modelo-de-dados)
5. [Autenticação e segurança](#5-autenticação-e-segurança)
6. [Backend](#6-backend)
7. [Frontend](#7-frontend)
8. [Importação de planilhas](#8-importação-de-planilhas)
9. [Áudio por toque](#9-áudio-por-toque)
10. [Alertas Web Push](#10-alertas-web-push)
11. [Integração Trello](#11-integração-trello)
12. [Variáveis de ambiente](#12-variáveis-de-ambiente)
13. [Migrações e publicação](#13-migrações-e-publicação)
14. [Testes e manutenção](#14-testes-e-manutenção)
15. [Histórico v3](#15-histórico-v3)

## 1. Arquitetura

O ProspectaFluxus é uma aplicação web full-stack monolítica. O processo Node.js serve a API Express/tRPC e os recursos estáticos produzidos pelo Vite. O PostgreSQL é o sistema de registo de utilizadores, leads, cadências, dispositivos e integrações.

```text
Navegador / PWA
      |
      | HTTPS + sessão protegida
      v
Railway: Express + tRPC + React estático
      |             |              |
      |             |              +-- Trello REST API (opcional)
      |             +-- Web Push para dispositivos inscritos
      +-- PostgreSQL
      +-- S3/R2 privado para áudios
```

O sistema continua funcional sem Trello, email ou IA. Web Push depende de chaves VAPID e o áudio no Railway depende de armazenamento S3 compatível. As integrações opcionais devem falhar sem reverter o estado local do lead.

## 2. Stack tecnológica

| Camada | Tecnologia principal | Linha de versão |
|---|---|---|
| Runtime | Node.js | 22.x |
| Backend HTTP | Express | 4.x |
| API tipada | tRPC | 11.18.x |
| ORM e migrações | Drizzle ORM / Drizzle Kit | 0.45.x / 0.31.x |
| Banco | PostgreSQL | 15+ |
| Frontend | React | 19.x |
| Build | Vite / esbuild | 7.x / 0.25.x |
| Estilos | Tailwind CSS | 4.x |
| Pacotes | pnpm | 10.34.x fixado com integridade |
| Linguagem | TypeScript | 5.9.x |
| Sessão | JWT com `jose` | 6.x |
| Password hashing | `bcryptjs` | 3.x |
| Web Push | `web-push` | 3.6.x |
| Excel no navegador | `read-excel-file` | 9.x |

As resoluções transitivas de segurança e os patches do projeto ficam em `pnpm-workspace.yaml`. A instalação de publicação deve usar o lockfile congelado.

## 3. Infraestrutura

### Railway

O Railway compila e inicia a aplicação conforme `railway.json`.

| Etapa | Comando |
|---|---|
| Build | `pnpm run build:prod` |
| Start | `node dist/index.js` |
| Reinício | Em falha, no máximo três tentativas |

O deploy da branch de produção pode ser automático. Por isso, alterações devem ser publicadas primeiro numa branch de revisão e só depois integradas com autorização.

### PostgreSQL

A aplicação usa a connection string em `DATABASE_URL`. A verificação de saúde ocorre em execução normal, mas é desativada no ambiente de testes unitários para evitar ligações laterais durante mocks.

### Armazenamento de áudio

No Railway, os áudios são guardados num bucket privado S3/R2 ou compatível. A infraestrutura integrada legada permanece suportada. O backend emite URLs assinados temporários somente depois de autenticar o pedido e verificar que o template pertence ao utilizador.

### Agendamentos

O endpoint de cron é `POST /api/cron/send-reminder`, protegido por `x-cron-secret`. Os períodos operacionais são `morning`, `afternoon` e `evening`. O agendador identifica o utilizador antes de enviar qualquer alerta.

## 4. Modelo de dados

As migrações ficam em `drizzle/` e são versionadas. As alterações v3 são aditivas.

| Tabela | Responsabilidade |
|---|---|
| `users` | Conta, autenticação, aprovação e perfil |
| `leads` | Dados do lead, estado da cadência, Kanban e sincronização Trello |
| `daily_sends` | Registo diário dos toques enviados |
| `send_schedules` | Horários, quantidades e identificadores das tarefas |
| `message_templates` | Texto e metadados do áudio opcional por toque |
| `push_subscriptions` | Subscrições Web Push por dispositivo e utilizador |
| `trello_integrations` | Lista Trello e credenciais cifradas por utilizador |

### Metadados de áudio

`message_templates` associa o objeto privado ao toque sem guardar o binário no PostgreSQL. O modelo mantém chave de armazenamento, nome, MIME type, tamanho e data de atualização.

### Web Push

`push_subscriptions` tem endpoint único, hash para deduplicação e índice por utilizador. Chaves de subscrição pertencem ao dispositivo; endpoints expirados são removidos quando o fornecedor responde com estado de expiração.

### Trello

`trello_integrations` guarda o identificador da lista, o nome exibido, o estado ativo e o conteúdo cifrado. `leads` mantém o identificador do cartão, estado de sincronização, última falha e instante da tentativa. Estes campos permitem reintento e idempotência sem alterar o estado local do lead.

## 5. Autenticação e segurança

A API de negócio usa procedures protegidas. Toda consulta ou alteração sensível inclui `userId` derivado da sessão, nunca recebido como autoridade do navegador.

| Controlo | Implementação |
|---|---|
| Sessão | JWT em cookie seguro, com `JWT_SECRET` fornecido por ambiente |
| Password | Hash com `bcryptjs`; nunca registada em logs |
| Áudio | Bucket privado, URL temporário e verificação de propriedade |
| Trello | AES-256-GCM com AAD vinculada ao `userId` |
| Web Push | Chave privada VAPID apenas no servidor |
| Cron | Segredo independente no cabeçalho do pedido |
| Upload | MIME type, extensão e tamanho validados no cliente e no servidor |
| Segredos | Sem fallbacks literais; configuração somente por ambiente |

As credenciais Trello são cifradas por `server/integrationCrypto.ts`. `INTEGRATION_ENCRYPTION_KEY` deve ter 32 bytes em hexadecimal ou Base64 e permanecer estável. A adulteração do conteúdo ou o uso numa conta diferente invalida a decifragem.

O repositório esteve temporariamente público e versões antigas continham valores sensíveis. Esses valores devem ser revogados no fornecedor; a remoção no Git não substitui a rotação.

## 6. Backend

| Ficheiro | Responsabilidade relevante |
|---|---|
| `server/routers.ts` | Contratos tRPC, leads, templates, notificações e Trello |
| `server/db.ts` | Consultas parametrizadas e isoladas por utilizador |
| `server/storage.ts` | Upload e URLs assinados para armazenamento integrado ou S3 |
| `server/_core/storageProxy.ts` | Autenticação e autorização no acesso ao áudio |
| `server/_core/notification.ts` | Envio Web Push multi-dispositivo e limpeza de endpoints |
| `server/scheduleHandler.ts` | Lembretes vinculados ao dono do agendamento |
| `server/cronHandler.ts` | Execução global protegida por segredo |
| `server/trello.ts` | Cliente Trello, timeout, deduplicação e sincronização |
| `server/integrationCrypto.ts` | Cifragem autenticada das credenciais Trello |

As falhas externas de Trello ou Web Push são tratadas por dispositivo/lead. Uma falha do Trello não reverte a transição local para **Respondeu**. Uma falha transitória de uma subscrição Web Push não bloqueia as demais.

## 7. Frontend

| Página ou recurso | Responsabilidade v3 |
|---|---|
| `CockpitPage.tsx` | Envio assistido, importação Excel e partilha de áudio |
| `SchedulePage.tsx` | Horários, templates e gestão do áudio por toque |
| `KanbanPage.tsx` | Estado Trello e reintento de sincronização |
| `ProfilePage.tsx` | Ativação Web Push, teste e configuração Trello |
| `useNotifications.ts` | Subscrição Web Push e estado do dispositivo |
| `public/sw.js` | Receção e clique de notificações em segundo plano |
| `public/manifest.webmanifest` | Instalação PWA e suporte móvel |

O service worker não mantém temporizadores locais. A fonte de verdade para o momento dos alertas é o backend persistente, e o service worker apenas recebe e apresenta a mensagem.[1]

## 8. Importação de planilhas

O ficheiro `.xlsx` é processado localmente com `read-excel-file`; o conteúdo bruto não é enviado como ficheiro ao servidor.[2]

1. O navegador lê os nomes das folhas e cada conjunto de linhas.
2. Os cabeçalhos são normalizados de forma tolerante a variações.
3. Linhas sem WhatsApp válido são descartadas.
4. Leads válidos são enviados em lotes de 50.
5. Somente o primeiro lote usa `replaceAll`.
6. O progresso é apresentado ao utilizador.

O antigo pacote `xlsx` foi removido porque a versão utilizada tinha vulnerabilidades sem correção disponível. A substituição preserva folhas múltiplas, camadas, cabeçalhos flexíveis e envio em lotes.

## 9. Áudio por toque

Cada um dos três templates pode ter um áudio opcional. O upload faz validação dupla, cria uma chave não previsível e guarda somente metadados no PostgreSQL.

| Operação | Comportamento |
|---|---|
| Adicionar | Envia o binário ao storage privado e associa-o ao toque |
| Reproduzir | Obtém URL temporário após autenticação |
| Substituir | Associa o novo objeto ao template |
| Remover | Elimina a associação; o texto permanece inalterado |
| Partilhar no móvel | Usa a API nativa de partilha quando suportada |
| Usar no computador | Faz download e abre o contacto no WhatsApp Web |

A aplicação não tenta anexar automaticamente um ficheiro num site de terceiros. O utilizador mantém o controlo da partilha e do envio final.

## 10. Alertas Web Push

O servidor usa o protocolo Web Push com VAPID. Cada navegador cria uma subscrição e envia endpoint e chaves ao backend. A notificação pode chegar com a página fechada, desde que o sistema operativo permita atividade do serviço de push.[1]

No iPhone, Web Push para aplicações web exige a instalação no Ecrã Principal e autorização solicitada por interação direta do utilizador.[3] No Android e em navegadores desktop compatíveis, a ativação pode ocorrer diretamente na aplicação.

O fluxo inclui:

1. Verificação de configuração VAPID pública no backend.
2. Registo ou atualização idempotente da subscrição do dispositivo.
3. Envio por utilizador em cada janela do cron.
4. Abertura segura do cockpit ao clicar na notificação.
5. Remoção automática de endpoints expirados.

## 11. Integração Trello

A API key e o token são introduzidos no Perfil e enviados apenas ao backend. O teste valida acesso à lista escolhida. O Trello aceita autenticação REST por key e token; a aplicação nunca devolve esses valores ao frontend depois de guardados.[4]

A sincronização ocorre somente quando o lead entra em **Respondeu**. A idempotência usa três camadas:

| Camada | Verificação |
|---|---|
| Local | Se `trelloCardId` já existe, não cria outro cartão |
| Concorrência | Estado transitório impede duas criações simultâneas |
| Remota | Marcador estável na descrição permite encontrar um cartão já criado |

O cliente consulta os cartões da lista para reconciliar o marcador antes da criação.[5] Em falha, regista uma mensagem segura e disponibiliza reintento no Kanban.

## 12. Variáveis de ambiente

O ficheiro `env.example.txt` é a referência sem segredos. As variáveis principais são:

| Grupo | Variáveis |
|---|---|
| Núcleo | `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET` |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Trello | `INTEGRATION_ENCRYPTION_KEY` |
| Áudio S3 | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` |
| IA opcional | `GEMINI_API_KEY`, `OPENROUTER_API_KEY` |
| Email opcional | `RESEND_API_KEY`, `NOTIFICATION_EMAIL` |
| Infraestrutura integrada | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` e variáveis legadas associadas |

Nenhuma chave privada ou token deve usar prefixo `VITE_`, porque variáveis deste grupo podem ser incorporadas no bundle do navegador.

## 13. Migrações e publicação

O histórico versionado de migrações é a fonte de verdade. Para atualizar uma base existente:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build:prod
pnpm db:migrate
```

`pnpm db:migrate` usa `DATABASE_URL` e aplica apenas migrações ainda não registadas pelo Drizzle. `scripts/migrate.mjs` é legado e não deve ser usado para a atualização v3.

Antes da migração de produção, crie um backup verificável. As migrações v3 são aditivas, portanto um rollback da aplicação para a versão anterior não exige remover imediatamente tabelas ou colunas.

Consulte `DEPLOY_RAILWAY.md` para a sequência operacional, variáveis, verificação pós-deploy e rollback.

## 14. Testes e manutenção

| Comando | Objetivo |
|---|---|
| `pnpm check` | Verificação TypeScript sem emissão |
| `pnpm test` | Regressão Vitest |
| `pnpm build:prod` | Build equivalente ao Railway |
| `pnpm audit --prod` | Auditoria das dependências de produção |

A suíte v3 cobre entrega Web Push, limpeza de subscrições expiradas, comportamento sem VAPID, cifragem autenticada, isolamento Trello por utilizador, deduplicação local/remota, concorrência e registo de falhas externas.

Os testes que dependem de serviços externos devem ser condicionais à presença da respetiva chave. Testes unitários não devem abrir ligações reais ao PostgreSQL.

## 15. Histórico v3

| Área | Alteração |
|---|---|
| Áudio | Upload privado, gestão por toque e partilha assistida |
| Alertas | Substituição de temporizadores locais por Web Push persistente |
| PWA | Manifesto, ícones e instruções para iPhone |
| Trello | Configuração cifrada, sincronização idempotente e reintento |
| Excel | Substituição do parser vulnerável por alternativa mantida |
| Segurança | Remoção de segredos incorporados e atualização das dependências |
| Migrações | Alterações aditivas testadas numa base PostgreSQL descartável |
| Documentação | Guia Railway, manual e exemplo de ambiente atualizados |

## Fontes técnicas

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Push_API "MDN — Push API"
[2]: https://github.com/catamphetamine/read-excel-file "read-excel-file — documentação oficial"
[3]: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ "WebKit — Web Push em iOS e iPadOS"
[4]: https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/ "Atlassian — autorização REST do Trello"
[5]: https://developer.atlassian.com/cloud/trello/rest/api-group-lists/ "Atlassian — cartões de uma lista"
