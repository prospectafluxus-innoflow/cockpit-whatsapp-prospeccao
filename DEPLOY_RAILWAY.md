# Guia de Deploy — ProspectaFluxus no Railway

**Custo:** $0 (plano gratuito com $5 de crédito/mês — mais do que suficiente)  
**Tempo estimado:** 15–20 minutos  
**Não precisa de cartão de crédito para começar**

---

## Passo 1 — Criar conta no Railway

1. Acesse **[railway.app](https://railway.app)**
2. Clique em **"Login"** → **"Login with Google"**
3. Selecione sua conta Google
4. Pronto — conta criada!

---

## Passo 2 — Exportar o código para o GitHub

O Railway faz o deploy direto do GitHub. Vamos exportar o código do Manus para lá.

1. No Manus, clique no menu **⋯ (três pontos)** no canto superior direito do painel
2. Clique em **"GitHub"** (ou "Export to GitHub")
3. Autorize o Manus a acessar sua conta GitHub
4. Escolha um nome para o repositório, ex: `prospectafluxus`
5. Clique em **"Export"**

> Se não tiver conta no GitHub, crie em [github.com](https://github.com) — é gratuito e leva 2 minutos.

---

## Passo 3 — Criar o projeto no Railway

1. No Railway, clique em **"New Project"**
2. Clique em **"Deploy from GitHub repo"**
3. Autorize o Railway a acessar seu GitHub (se pedido)
4. Selecione o repositório `prospectafluxus`
5. Clique em **"Deploy Now"**

O Railway vai detectar automaticamente o `railway.json` e iniciar o build.

---

## Passo 4 — Configurar as variáveis de ambiente

Após o deploy inicial (vai falhar na primeira vez por falta das variáveis — isso é normal), configure as variáveis:

1. No Railway, clique no serviço **prospectafluxus**
2. Vá na aba **"Variables"**
3. Clique em **"New Variable"** e adicione **uma por uma**:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://postgres:[SENHA]@db.[PROJETO].supabase.co:5432/postgres` |
| `JWT_SECRET` | `ProspectaFluxus@InnoFlow2026#JWT!` |
| `GEMINI_API_KEY` | `AQ.Ab8RN6KBe0B3flZqZApWdEST5pGFq9o7inSzq9wavzUxOhdC2w` |
| `CRON_SECRET` | `ProspectaFluxus@InnoFlow2026#Cron!` |
| `PORT` | `3000` |

### Onde encontrar o DATABASE_URL do Supabase:
1. Acesse **[supabase.com](https://supabase.com)** → seu projeto
2. Vá em **Settings → Database → Connection string**
3. Selecione **URI** e copie o valor
4. Substitua `[YOUR-PASSWORD]` pela senha que você definiu ao criar o banco

---

## Passo 5 — Fazer o redeploy

Após adicionar todas as variáveis:

1. Vá na aba **"Deployments"**
2. Clique nos três pontos **⋯** do último deploy
3. Clique em **"Redeploy"**

Aguarde 2–3 minutos. O status ficará verde ✅ quando estiver pronto.

---

## Passo 6 — Executar a migração do banco

Após o deploy funcionar, execute a migração para criar as tabelas no Supabase:

1. No Railway, vá na aba **"Settings"** do serviço
2. Role até **"Deploy"** → encontre o campo **"Start Command"**
3. Temporariamente substitua por: `node scripts/migrate.mjs`
4. Clique em **"Save"** — isso vai rodar a migração
5. Após o deploy concluir (tabelas criadas), volte e mude o comando de volta para: `node dist/index.js`

> **Alternativa mais fácil:** use o painel do Supabase para rodar o SQL diretamente. Veja o arquivo `drizzle/migrations/` no projeto para o SQL gerado.

---

## Passo 7 — Obter a URL do sistema

1. No Railway, vá na aba **"Settings"** do serviço
2. Role até **"Networking"** → **"Public Networking"**
3. Clique em **"Generate Domain"**
4. Sua URL será algo como: `prospectafluxus-production.up.railway.app`

**Guarde essa URL** — é ela que vai no botão "Área do Cliente" do site da InnoFlow.

---

## Passo 8 — Atualizar o botão no site da InnoFlow

Abra o arquivo `index_modified.html` que baixou e substitua:
```
https://app.innoflow.com.br
```
pela URL real do Railway:
```
https://prospectafluxus-production.up.railway.app
```

Depois faça o upload no Netlify.

---

## Passo 9 — Configurar os agendamentos automáticos (Cron Jobs)

O Railway tem suporte nativo a Cron Jobs:

1. No Railway, clique em **"New"** → **"Cron Job"**
2. Configure 3 jobs:

| Nome | Schedule (UTC) | Horário BR | Comando |
|---|---|---|---|
| Lembrete Manhã | `0 11 * * *` | 8h | Ver abaixo |
| Lembrete Almoço | `0 16 * * *` | 13h | Ver abaixo |
| Lembrete Tarde | `0 21 * * *` | 18h | Ver abaixo |

Para cada job, use este comando (substitua a URL e o secret):
```bash
curl -X POST https://prospectafluxus-production.up.railway.app/api/cron/send-reminder \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: ProspectaFluxus@InnoFlow2026#Cron!" \
  -d '{"period":"morning"}'
```
(Mude `morning` para `afternoon` e `evening` nos outros dois jobs)

---

## (Opcional) Passo 10 — Domínio personalizado

Para usar `app.innoflow.com.br`:

1. No Railway → **Settings → Networking → Custom Domain**
2. Digite `app.innoflow.com.br`
3. O Railway mostrará um registro CNAME para adicionar no DNS do seu domínio
4. Adicione no painel do Registro.br (ou onde o domínio está)
5. Aguarde até 24h para propagar

---

## Resumo dos limites gratuitos do Railway

| Recurso | Limite gratuito | Uso estimado |
|---|---|---|
| Créditos/mês | $5,00 | ~$0,50/mês ✅ |
| RAM | 512 MB | ~100 MB ✅ |
| CPU | Compartilhada | Leve ✅ |
| Banda | 100 GB | ~1 GB ✅ |
| Cron Jobs | Incluído | 3 jobs ✅ |

---

## Suporte

Em caso de dúvidas:
- [Documentação do Railway](https://docs.railway.app)
- [Documentação do Supabase](https://supabase.com/docs)
