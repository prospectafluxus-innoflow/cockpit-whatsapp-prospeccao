# Guia de Deploy — ProspectaFluxus no Google Cloud Run

**Stack:** Google Cloud Run (hospedagem) + Supabase (banco PostgreSQL) + Google Gemini (IA)  
**Custo estimado:** R$ 0,00/mês dentro dos limites gratuitos

---

## Pré-requisitos

- Conta Google (já tem ✅)
- Chave Gemini (já configurada ✅)
- Banco Supabase (já criado ✅)
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) instalado no computador

---

## Passo 1 — Instalar o Google Cloud CLI

### Windows
1. Acesse: https://cloud.google.com/sdk/docs/install-sdk#windows
2. Baixe o instalador `.exe` e execute
3. Siga o assistente de instalação
4. Ao final, abrirá um terminal — pressione Enter para fazer login

### Mac
```bash
brew install google-cloud-sdk
```

### Verificar instalação
```bash
gcloud --version
```

---

## Passo 2 — Fazer login e criar o projeto

```bash
# Login na sua conta Google
gcloud auth login

# Criar um novo projeto (substitua "prospectafluxus" por um nome único)
gcloud projects create prospectafluxus-app --name="ProspectaFluxus"

# Definir o projeto como padrão
gcloud config set project prospectafluxus-app

# Ativar as APIs necessárias
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
```

---

## Passo 3 — Baixar o código do ProspectaFluxus

No Manus, clique em **⋯ (três pontos)** → **"Download as ZIP"** e extraia em uma pasta no seu computador.

Abra o terminal dentro dessa pasta:
```bash
cd caminho/para/cockpit-whatsapp-prospeccao
```

---

## Passo 4 — Fazer o deploy no Cloud Run

```bash
# Deploy direto (o Cloud Run faz o build automaticamente com o Dockerfile)
gcloud run deploy prospectafluxus \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --set-env-vars "NODE_ENV=production"
```

Aguarde alguns minutos. Ao final, o terminal mostrará a URL do sistema, algo como:
```
Service URL: https://prospectafluxus-xxxx-uc.a.run.app
```

**Guarde essa URL** — ela será usada nos próximos passos.

---

## Passo 5 — Configurar as variáveis de ambiente

Substitua os valores pelos seus dados reais:

```bash
gcloud run services update prospectafluxus \
  --region us-central1 \
  --set-env-vars \
"DATABASE_URL=postgresql://postgres:[SUA_SENHA]@db.[SEU_PROJETO].supabase.co:5432/postgres,\
JWT_SECRET=[UMA_STRING_LONGA_ALEATORIA],\
GEMINI_API_KEY=[CRIE_UMA_NOVA_CHAVE_NO_GOOGLE_AI_STUDIO],\
CRON_SECRET=[OUTRA_STRING_LONGA_ALEATORIA],\
NODE_ENV=production"
```

### Onde encontrar o DATABASE_URL do Supabase:
1. Acesse https://supabase.com → seu projeto
2. Vá em **Settings → Database → Connection string**
3. Selecione **URI** e copie

### Como gerar JWT_SECRET e CRON_SECRET:
Gere dois valores diferentes e imprevisíveis com `openssl rand -base64 48`. Nunca reutilize exemplos de documentação nem grave os valores no repositório.

---

## Passo 6 — Executar a migração do banco

```bash
# Instalar dependências localmente (apenas uma vez)
npm install -g tsx

# Rodar a migração
DATABASE_URL="postgresql://postgres:[SUA_SENHA]@db.[SEU_PROJETO].supabase.co:5432/postgres" \
node scripts/migrate.mjs
```

---

## Passo 7 — Configurar os agendamentos automáticos (Cloud Scheduler)

Os lembretes automáticos são enviados 3 vezes ao dia. Substitua `[SUA_URL]` pela URL do Cloud Run e `[SEU_CRON_SECRET]` pelo valor que definiu:

```bash
# Lembrete da manhã (8h, horário de Brasília)
gcloud scheduler jobs create http prospectafluxus-morning \
  --location us-central1 \
  --schedule "0 11 * * *" \
  --uri "https://prospectafluxus-xxxx-uc.a.run.app/api/cron/send-reminder" \
  --message-body '{"period":"morning"}' \
  --headers "Content-Type=application/json,x-cron-secret=[SEU_CRON_SECRET]" \
  --time-zone "UTC"

# Lembrete do almoço (13h, horário de Brasília)
gcloud scheduler jobs create http prospectafluxus-afternoon \
  --location us-central1 \
  --schedule "0 16 * * *" \
  --uri "https://prospectafluxus-xxxx-uc.a.run.app/api/cron/send-reminder" \
  --message-body '{"period":"afternoon"}' \
  --headers "Content-Type=application/json,x-cron-secret=[SEU_CRON_SECRET]" \
  --time-zone "UTC"

# Lembrete do fim do dia (18h, horário de Brasília)
gcloud scheduler jobs create http prospectafluxus-evening \
  --location us-central1 \
  --schedule "0 21 * * *" \
  --uri "https://prospectafluxus-xxxx-uc.a.run.app/api/cron/send-reminder" \
  --message-body '{"period":"evening"}' \
  --headers "Content-Type=application/json,x-cron-secret=[SEU_CRON_SECRET]" \
  --time-zone "UTC"
```

---

## Passo 8 — Atualizar o botão no site da InnoFlow

Após o deploy, substitua `https://app.innoflow.com.br` no `index_modified.html` pela URL real do Cloud Run:

```
https://prospectafluxus-xxxx-uc.a.run.app
```

---

## (Opcional) Passo 9 — Domínio personalizado

Para usar `app.innoflow.com.br` em vez da URL do Google:

```bash
gcloud run domain-mappings create \
  --service prospectafluxus \
  --domain app.innoflow.com.br \
  --region us-central1
```

O comando mostrará os registros DNS para adicionar no painel do seu domínio (Registro.br ou onde estiver).

---

## Resumo dos limites gratuitos

| Serviço | Limite gratuito | Uso estimado |
|---|---|---|
| Cloud Run | 2M req/mês + 360.000 vCPU-s | ~1.000 req/mês ✅ |
| Cloud Scheduler | 3 jobs gratuitos | 3 jobs ✅ |
| Supabase | 500 MB banco + 5 GB transferência | ~10 MB ✅ |
| Gemini API | 1.500 req/dia | ~50 req/dia ✅ |

---

## Suporte

Em caso de dúvidas, entre em contato com a InnoFlow ou consulte:
- [Documentação do Cloud Run](https://cloud.google.com/run/docs)
- [Documentação do Supabase](https://supabase.com/docs)
