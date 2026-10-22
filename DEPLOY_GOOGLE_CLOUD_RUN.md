# Guia de Deploy — ProspectaFluxus no Google Cloud Run

**Stack:** Google Cloud Run (hospedagem) + Supabase/PostgreSQL (banco) + integrações configuradas por Secret Manager.

> **Custo:** não existe promessa de custo zero. O custo final depende de região, tráfego, CPU, memória, builds, armazenamento de imagens, rede, Secret Manager, Supabase, Gemini e do estado de faturamento/quota da conta. As faixas gratuitas são limites, não uma garantia de cobrança nula.

Este guia descreve um primeiro deploy **privado**. O serviço só deve receber `allUsers` depois que os secrets, o callback de autenticação e o health check forem validados.

---

## 1. Pré-requisitos

- Projeto Google Cloud com faturamento e `gcloud` instalado.
- Permissões para Cloud Run, Cloud Build, Artifact Registry e Secret Manager.
- Supabase já existente. A aplicação continua usando o PostgreSQL do Supabase pela variável `DATABASE_URL`; este deploy não troca o banco.
- Secrets criados previamente no Secret Manager por um operador/cofre aprovado. Os valores não devem ser gravados no repositório, no Dockerfile ou na linha de comando do script.
- A conta de serviço de runtime do Cloud Run com `roles/secretmanager.secretAccessor` nos secrets necessários.

Ative somente as APIs necessárias ao seu projeto, conforme a política da organização:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

O repositório contém o `Dockerfile`; o deploy usa `--source .` e, portanto, pode usar Cloud Build e Artifact Registry.

---

## 2. Configuração protegida de secrets

O script `scripts/deploy-cloud-run.sh` recebe apenas **nomes** de secrets por variáveis de configuração protegida. Ele nunca recebe valores de `DATABASE_URL`, chaves, tokens ou segredos inline.

Obrigatórios:

```bash
export CLOUD_RUN_SECRET_DATABASE_URL_NAME='nome-do-secret-da-url-do-supabase'
export CLOUD_RUN_SECRET_JWT_SECRET_NAME='nome-do-secret-jwt'
export CLOUD_RUN_SECRET_CRON_SECRET_NAME='nome-do-secret-cron'
```

Opcionais, somente se a funcionalidade correspondente estiver habilitada:

```bash
export CLOUD_RUN_SECRET_GEMINI_API_KEY_NAME='nome-do-secret-gemini'
export CLOUD_RUN_SECRET_OPENROUTER_API_KEY_NAME='nome-do-secret-openrouter'
export CLOUD_RUN_SECRET_BUILT_IN_FORGE_API_KEY_NAME='nome-do-secret-forge'
export CLOUD_RUN_SECRET_WABLAST_API_KEY_NAME='nome-do-secret-wablast'
export CLOUD_RUN_SECRET_WABLAST_WEBHOOK_SECRET_NAME='nome-do-secret-webhook-wablast'
export CLOUD_RUN_SECRET_INTEGRATION_ENCRYPTION_KEY_NAME='nome-do-secret-integrations'
export CLOUD_RUN_SECRET_RESEND_API_KEY_NAME='nome-do-secret-resend'
export CLOUD_RUN_SECRET_S3_ACCESS_KEY_ID_NAME='nome-do-secret-s3-access-key'
export CLOUD_RUN_SECRET_S3_SECRET_ACCESS_KEY_NAME='nome-do-secret-s3-secret-key'
export CLOUD_RUN_SECRET_VAPID_PRIVATE_KEY_NAME='nome-do-secret-vapid-private'
```

Os valores acima são exemplos de **nomes**, não valores secretos. O script referencia cada secret como `NOME_DA_VARIAVEL=secret-name:latest`. A rotação de uma versão deve seguir o processo da organização; não coloque uma URI de Supabase ou token na documentação.

`DATABASE_URL` permanece a conexão Supabase. O container não executa `db:migrate`, `drizzle-kit migrate` nem qualquer outro migration automaticamente.

Também forneça `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT` com o e-mail da conta técnica de execução e `CLOUD_RUN_BUILD_SERVICE_ACCOUNT` no formato `projects/PROJECT_ID/serviceAccounts/EMAIL`. A conta de runtime recebe acesso somente aos secrets da aplicação; a de build recebe `roles/run.builder` no projeto. Não use uma conta com permissão de Editor para executar a aplicação.

`CLOUD_RUN_PUBLIC_ENV_FILE` pode apontar para um arquivo YAML/JSON contendo somente configurações não secretas: `NODE_ENV`, `FLUXUS_FEEDBACK_ENABLED`, configurações públicas de bucket/endpoint S3 e chave pública VAPID, além de campos vazios preservados. Credenciais continuam exclusivamente no Secret Manager. O flag de feedback deve permanecer `true` quando essa funcionalidade estiver habilitada na produção original.

---

## 3. Deploy privado inicial

Execute a partir da raiz do repositório, depois de carregar a configuração protegida:

```bash
chmod +x scripts/deploy-cloud-run.sh

scripts/deploy-cloud-run.sh \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$GOOGLE_CLOUD_REGION" \
  --service "$CLOUD_RUN_SERVICE"
```

O script configura:

- `min=0` e `max=1` instância;
- `1` vCPU e `512Mi` de memória;
- CPU alocada por requisição (`--cpu-throttling`);
- porta `8080` (o Cloud Run injeta `PORT`, que o entrypoint valida sem fallback);
- `NODE_ENV=production`;
- `--no-allow-unauthenticated` para manter o serviço privado;
- referências a Secret Manager, sem valores inline.

O script **não** cria Cloud Scheduler, não cria webhooks públicos e não executa migrations. A imagem também não copia scripts de migration para o runtime. A aplicação aguarda a tentativa de sincronização Trello dentro da requisição, evitando que ela fique abandonada depois da resposta em um serviço com CPU por requisição; falhas continuam registradas e não invalidam a atualização do lead.

Não acrescente uma permissão pública neste primeiro passo.

---

## 4. Validar sem tornar o serviço público

O endpoint de aplicação é deliberadamente genérico:

```http
GET /api/health
200 {"ok":true}
```

Ele não retorna secrets, versão, URL de banco ou diagnóstico interno. Como o serviço ainda é privado, valide usando uma identidade autorizada:

```bash
SERVICE_URL="$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$GOOGLE_CLOUD_REGION" \
  --format='value(status.url)')"

curl --fail-with-body \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "$SERVICE_URL/api/health"
```

Também confirme nos logs que o processo subiu na porta fornecida pelo Cloud Run, que o callback OAuth não está apontando para o ambiente antigo e que o acesso ao Supabase funciona antes de abrir tráfego público.

Depois da validação de secrets, autenticação e rotas, a publicação pública é uma decisão explícita do operador, por exemplo via IAM:

```bash
gcloud run services add-iam-policy-binding "$CLOUD_RUN_SERVICE" \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$GOOGLE_CLOUD_REGION" \
  --member='allUsers' \
  --role='roles/run.invoker'
```

Esse comando não faz parte do script inicial.

---

## 5. Contrato do cron (não provisionado automaticamente)

O deploy não cria jobs. Se um operador configurar um scheduler posteriormente, o endpoint independente exige:

```http
POST /api/cron/send-reminder
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json

{"window":"morning"}
```

`window` deve ser exatamente um destes valores:

- `morning`
- `lunch`
- `afternoon`
- `evening`

Sem `CRON_SECRET` configurado, ou com bearer ausente/incorreto, a resposta é `401`; uma janela inválida retorna `400`. O valor do secret deve ser obtido pelo mecanismo protegido aprovado, nunca commitado ou colado no repositório.

O endpoint `/api/scheduled/send-reminder` é uma integração distinta. Não foi reconfigurado neste trabalho. Webhooks WaBlast/Trello continuam dependendo de seus próprios secrets e de uma decisão posterior de exposição/roteamento.

---

## 6. Supabase e migrations

- Supabase continua sendo o banco da aplicação via `DATABASE_URL` no Secret Manager.
- O deploy não roda migrations, seed, cron, webhook registration ou limpeza de dados.
- Qualquer migration deve ser revisada e executada separadamente, com janela, backup e procedimento de rollback aprovados.
- O Cloud Run é stateless; arquivos locais não são armazenamento durável. A rota existente `/manus-storage/*` ainda depende do backend de storage configurado e precisa de validação específica antes do corte.

---

## 7. Limites gratuitos e custos possíveis

Os limites variam por produto, região, conta e data. Como referência para o free tier usual do Cloud Run, mantenha as unidades separadas:

A referência mensal usual para cobrança por requisição é de 2 milhões de requisições, 180.000 vCPU-segundos e 360.000 GiB-segundos. CPU e memória são cotas distintas: `512Mi` representa `0,5 GiB`, não uma quantidade de vCPU. A franquia não inclui necessariamente rede e outros produtos. Nenhum job do Cloud Scheduler é criado por esse roteiro.

Mesmo dentro de uma faixa gratuita, podem existir custos ou requisitos de faturamento para:

- Cloud Build e armazenamento/egress do Artifact Registry gerados pelo `--source .`;
- tráfego de saída e serviços Google usados pelas integrações;
- armazenamento e operações do Secret Manager;
- Supabase, Gemini, WaBlast, Resend e demais fornecedores;
- regiões, quotas, créditos promocionais expirados ou mudanças de preço.

Consulte a tabela vigente do Google Cloud e dos fornecedores antes de considerar o orçamento fechado.

---

## 8. Domínio personalizado e operação posterior

Só depois do corte controlado, configure domínio, IAM público (se necessário), callback OAuth, Scheduler e webhooks conforme os contratos de cada fornecedor. Nenhuma dessas mudanças é feita por `scripts/deploy-cloud-run.sh`.

Referências: [Cloud Run](https://cloud.google.com/run/docs), [Secret Manager](https://cloud.google.com/secret-manager/docs), [Cloud Run pricing](https://cloud.google.com/run/pricing) e [Supabase](https://supabase.com/docs).

## Implantação realizada em 22/10/2026

A aplicação foi publicada em **https://prospectafluxus-664809259352.us-west1.run.app**, no serviço `prospectafluxus`, região `us-west1`. A revisão inicial pronta é `prospectafluxus-00001-lwg`; o build inicial concluiu com sucesso. O deploy preserva o PostgreSQL e o storage S3 do Supabase e mantém `FLUXUS_FEEDBACK_ENABLED=true`.

Foram configuradas contas técnicas separadas para build e runtime. Nove credenciais existentes foram importadas no Secret Manager sem serem incluídas no Git, Dockerfile ou pacote de código. O serviço usa 1 vCPU, 512Mi, CPU por requisição, mínimo zero e máximo configurado de uma instância tanto no serviço quanto na revisão. Esses limites reduzem consumo, mas não são um teto mensal de cobrança.

A conta de faturamento autorizada foi ativada. O Google confirmou a criação de um alerta mensal de R$ 30; o alerta avisa sobre consumo e não bloqueia cobranças.

Antes da exposição pública, passaram nove verificações HTTP sem criação ou alteração de dados: health, HTML, bundle principal, código de alteração de avaliador, sessão ausente, feedback bloqueado sem login, áudio bloqueado sem login, consulta Supabase com rejeição de um login inexistente e cron rejeitando token inválido. Após a liberação IAM, o endereço público e o health responderam HTTP 200, o módulo de feedback atual foi confirmado e feedback sem login continuou retornando HTTP 401. Também passaram 12 testes de porta/cron e 10 testes Trello, TypeScript e build de produção.

**A transição completa não foi encerrada:** Railway permanece ativo como contingência. URLs de lembretes e webhooks não foram alteradas, nenhuma migration foi executada e nenhuma cobrança/subscrição antiga foi cancelada. O login real de clientes, integrações externas, URLs de links já distribuídos e configuração de automações precisam ser conferidos antes de desativar o host anterior. No novo domínio, o usuário precisa entrar novamente com suas credenciais habituais; cookies de sessão do Railway não são compartilhados entre domínios.

## Operação confirmada em 22/10/2026 — primeira CI e Scheduler

O PR #36 foi integrado e o GitHub Actions publicou automaticamente a revisão `prospectafluxus-00003-llh`, com 100% do tráfego e label `git-sha=20f419bca0af95c39282660c19158c3c0f8f74c2`. A execução https://github.com/prospectafluxus-innoflow/cockpit-whatsapp-prospeccao/actions/runs/39866951576 terminou com sucesso, incluindo TypeScript, 248 testes unitários, build, smoke público e conferência de provenance. Dois testes externos foram pulados.

A CI usa WIF, não chave JSON permanente, e restringe a identidade ao repositório/proprietário por IDs numéricos, `main`, workflow exato e eventos autorizados. O workflow mantém as referências existentes de secrets e configurações; não executa migration, não recria o Scheduler e não altera IAM público. `gha-creds-*.json` fica excluído do Git e dos contextos Google/Docker.

Foi aplicada separadamente a migration operacional `cloud_run_reminder_dispatch_ledger`, com RLS, sem alterar dados de avaliação ou participantes. Um único job `fluxus-reminders-hourly` consulta o dispatcher às horas cheias (`0 * * * *`, `America/Sao_Paulo`). O dispatcher seleciona as janelas pela hora cadastrada de cada usuário e reserva uma entrega por usuário/data local/janela. Para prevenir duplicação, não há retry automático de uma reserva já feita; falha ou entrega ambígua permanece registrada para revisão.

O contrato novo é `POST /api/cron/dispatch-reminders`, JSON `{"dryRun":false}`, protegido por `Authorization: Bearer <CRON_SECRET>`. O modo `{"dryRun":true}` não reserva nem envia notificações. Não aceita `now` fornecido por HTTP. O endpoint exige `REMINDER_SCHEDULER_PROVIDER=google`; essa configuração foi aplicada somente no Google. O endpoint legado `/api/cron/send-reminder` foi preservado e, no modo Google, usa o mesmo ledger. `APP_BASE_URL` contém o endereço Google para os links de notificação.

O teste sem envio respondeu HTTP 200 por chamada direta e pelo Scheduler; depois o job foi habilitado com corpo real. Não foi simulado envio positivo a usuários. As inscrições Web Push antigas são preservadas, mas a permissão no novo domínio depende de ação do próprio usuário.

A recuperação do site institucional foi confirmada: principais imagens, Blog e Colaborador respondem, e os botões Área do Cliente/Persona apontam ao Google. A publicação Netlify foi reservada à usuária; não houve rollback/upload realizado pelo agente.

**Pendências de corte preservadas:** o login real no novo domínio ainda precisa ser validado. O S3 respondeu por leitura, mas não há áudio existente para teste de reprodução. As duas credenciais Trello armazenadas não foram decifradas pela chave configurada; é necessário recuperar a chave original correta ou reconectar as integrações com a identidade adequada. Não foi comprovado que essa divergência começou na migração. Nenhuma credencial Trello foi sobrescrita. WaBlast permanece desabilitado e com fila pausada; seu callback externo precisa de validação antes de futura ativação. Railway e sua subscrição continuam ativos e não devem ser removidos antes de resolver essas pendências e obter autorização específica.
