# Guia de Deploy — ProspectaFluxus no Google Cloud

Stack final: **Google Cloud Run** (hospedagem) + **Supabase** (banco já criado) + **Google Gemini** (IA já configurada) + **Google Cloud Scheduler** (lembretes automáticos).

---

## O que você vai precisar

| Item | Status |
|---|---|
| Conta Google (Gmail) | ✅ Já tem |
| Chave Gemini API | ✅ Já configurada |
| Banco Supabase | ✅ Já criado |
| Google Cloud CLI instalado | ⬜ Instalar (passo 1) |
| Código exportado do Manus | ⬜ Exportar (passo 2) |

---

## Etapa 1 — Instalar o Google Cloud CLI

1. Acesse: **https://cloud.google.com/sdk/docs/install**
2. Baixe o instalador para Windows
3. Execute e siga o assistente de instalação
4. Ao final, abra o **Prompt de Comando** e execute:
   ```
   gcloud init
   ```
5. Faça login com sua conta Google quando solicitado
6. Crie um novo projeto quando perguntado — sugestão de nome: `prospectafluxus`

---

## Etapa 2 — Exportar o código do Manus

1. No Manus, clique em **⋯ (três pontos) no canto superior direito**
2. Selecione **"Download as ZIP"**
3. Extraia o ZIP em uma pasta no seu computador, por exemplo: `C:\ProspectaFluxus`

---

## Etapa 3 — Fazer o Deploy no Cloud Run

Abra o **Prompt de Comando**, navegue até a pasta do projeto e execute os comandos abaixo **um por um**:

### 3.1 Entrar na pasta do projeto
```cmd
cd C:\ProspectaFluxus
```

### 3.2 Configurar o projeto Google Cloud
```cmd
gcloud config set project prospectafluxus
```

### 3.3 Ativar os serviços necessários
```cmd
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
```

### 3.4 Fazer o deploy (um único comando!)
```cmd
gcloud run deploy prospectafluxus ^
  --source . ^
  --region us-central1 ^
  --platform managed ^
  --allow-unauthenticated ^
  --port 8080 ^
  --memory 512Mi ^
  --set-env-vars "NODE_ENV=production" ^
  --set-env-vars "DATABASE_URL=COLE_SUA_CONNECTION_STRING_AQUI" ^
  --set-env-vars "JWT_SECRET=COLE_UMA_STRING_ALEATORIA_AQUI" ^
  --set-env-vars "GEMINI_API_KEY=AQ.Ab8RN6KBe0B3flZqZApWdEST5pGFq9o7inSzq9wavzUxOhdC2w" ^
  --set-env-vars "CRON_SECRET=COLE_OUTRA_STRING_ALEATORIA_AQUI"
```

> **Substitua:**
> - `COLE_SUA_CONNECTION_STRING_AQUI` → a URL do Supabase (formato: `postgresql://postgres:SENHA@db.xxx.supabase.co:5432/postgres`)
> - `COLE_UMA_STRING_ALEATORIA_AQUI` → qualquer texto longo (ex: `ProspectaFluxus2026@InnoFlow!`)
> - `COLE_OUTRA_STRING_ALEATORIA_AQUI` → outro texto longo diferente

O deploy demora cerca de **3 a 5 minutos** na primeira vez (compila o Docker). Ao final, você receberá uma URL como:
```
https://prospectafluxus-xxxxxxxx-uc.a.run.app
```

---

## Etapa 4 — Criar as tabelas no banco

Execute o script de migração **uma única vez** para criar as tabelas no Supabase:

```cmd
set DATABASE_URL=postgresql://postgres:SENHA@db.xxx.supabase.co:5432/postgres
node scripts\migrate.mjs
```

Você verá:
```
✅ Migração concluída com sucesso!
🎉 Banco de dados pronto para uso!
```

---

## Etapa 5 — Configurar os lembretes automáticos (Cloud Scheduler)

Execute os 3 comandos abaixo para criar os agendamentos. Substitua `SUA-URL` pela URL que o Cloud Run gerou:

**Lembrete da manhã — 8h BRT (seg a sex)**
```cmd
gcloud scheduler jobs create http prospectafluxus-morning ^
  --location us-central1 ^
  --schedule "0 11 * * 1-5" ^
  --uri "https://SUA-URL.run.app/api/cron/send-reminder" ^
  --message-body "{\"window\":\"morning\"}" ^
  --headers "Content-Type=application/json,Authorization=Bearer CRON_SECRET" ^
  --time-zone "America/Sao_Paulo"
```

**Lembrete do almoço — 12h BRT (seg a sex)**
```cmd
gcloud scheduler jobs create http prospectafluxus-lunch ^
  --location us-central1 ^
  --schedule "0 15 * * 1-5" ^
  --uri "https://SUA-URL.run.app/api/cron/send-reminder" ^
  --message-body "{\"window\":\"lunch\"}" ^
  --headers "Content-Type=application/json,Authorization=Bearer CRON_SECRET" ^
  --time-zone "America/Sao_Paulo"
```

**Lembrete do fim do dia — 17h BRT (seg a sex)**
```cmd
gcloud scheduler jobs create http prospectafluxus-evening ^
  --location us-central1 ^
  --schedule "0 20 * * 1-5" ^
  --uri "https://SUA-URL.run.app/api/cron/send-reminder" ^
  --message-body "{\"window\":\"evening\"}" ^
  --headers "Content-Type=application/json,Authorization=Bearer CRON_SECRET" ^
  --time-zone "America/Sao_Paulo"
```

> Substitua `CRON_SECRET` pelo mesmo valor usado no deploy.

---

## Etapa 6 — Primeiro acesso

1. Acesse a URL gerada pelo Cloud Run
2. Clique em **"Criar conta"**
3. Cadastre seu nome, email e senha
4. Pronto — o ProspectaFluxus está rodando no Google! 🎉

---

## Custos estimados (plano gratuito)

| Serviço | Limite gratuito | Uso esperado |
|---|---|---|
| Cloud Run | 2 milhões req/mês | ~1.000 req/mês ✅ |
| Cloud Build | 120 min/dia | ~5 min/deploy ✅ |
| Cloud Scheduler | 3 jobs gratuitos | 3 jobs ✅ |
| Supabase | 500 MB banco | ~50 MB ✅ |
| Gemini API | 1.500 req/dia | ~10 req/dia ✅ |

**Custo total estimado: R$ 0,00/mês** para uso pessoal da Michelle.

---

## Atualizações futuras

Sempre que quiser atualizar o sistema, baixe o ZIP mais recente do Manus e execute novamente:
```cmd
gcloud run deploy prospectafluxus --source . --region us-central1
```

O Cloud Run faz o deploy da nova versão sem tirar o sistema do ar.
