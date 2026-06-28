# Guia de Deploy — ProspectaFluxus

Este guia cobre o processo completo para hospedar o ProspectaFluxus de forma **100% independente**, usando serviços gratuitos: **Supabase** (banco de dados), **Render** (hospedagem) e **Google Gemini** (IA).

---

## Pré-requisitos

Antes de começar, você precisará de contas nos seguintes serviços (todos gratuitos):

| Serviço | Finalidade | Link |
|---|---|---|
| GitHub | Hospedar o código-fonte | https://github.com |
| Supabase | Banco de dados PostgreSQL | https://supabase.com |
| Render | Hospedagem da aplicação | https://render.com |
| Google AI Studio | Chave da API Gemini (IA) | https://aistudio.google.com |

---

## Etapa 1 — Banco de Dados no Supabase

### 1.1 Criar o projeto

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em **"New project"**
3. Preencha:
   - **Name:** `prospectafluxus`
   - **Database Password:** crie uma senha forte e **guarde-a** (você vai precisar)
   - **Region:** South America (São Paulo) — mais próximo do Brasil
4. Clique em **"Create new project"** e aguarde ~2 minutos

### 1.2 Obter a connection string

1. No painel do Supabase, vá em **Settings → Database**
2. Role até a seção **"Connection string"**
3. Selecione a aba **"URI"**
4. Copie a string — ela tem o formato:
   ```
   postgresql://postgres:[SUA-SENHA]@db.xxxx.supabase.co:5432/postgres
   ```
5. Substitua `[SUA-SENHA]` pela senha que você criou no passo anterior

### 1.3 Criar as tabelas

Execute o script de migração localmente (com Node.js instalado):

```bash
# Clone o repositório primeiro (veja Etapa 2)
DATABASE_URL="postgresql://postgres:SUA_SENHA@db.xxxx.supabase.co:5432/postgres" \
  node scripts/migrate.mjs
```

Você verá a mensagem:
```
✅ Migração concluída com sucesso!
🎉 Banco de dados pronto para uso!
```

---

## Etapa 2 — Código no GitHub

### 2.1 Exportar o código

1. No Manus, acesse o painel do projeto
2. Clique em **⋯ (três pontos) → Download as ZIP** ou use a opção **GitHub** nas configurações
3. Se baixou o ZIP: extraia e crie um repositório no GitHub
4. Se usou a integração GitHub: o repositório já está criado

### 2.2 Verificar o repositório

Certifique-se de que os seguintes arquivos estão presentes:
- `render.yaml` — configuração do Render
- `scripts/migrate.mjs` — script de migração
- `package.json` com os scripts `build:prod` e `start:prod`

---

## Etapa 3 — Deploy no Render

### 3.1 Criar o serviço

1. Acesse [render.com](https://render.com) e faça login
2. Clique em **"New +" → "Web Service"**
3. Conecte ao seu repositório GitHub
4. O Render detectará automaticamente o `render.yaml` — confirme as configurações

### 3.2 Configurar as variáveis de ambiente

No painel do serviço, vá em **Environment → Environment Variables** e adicione:

| Variável | Valor | Onde obter |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:SENHA@db.xxx.supabase.co:5432/postgres` | Supabase → Settings → Database |
| `JWT_SECRET` | Qualquer string longa e aleatória | `openssl rand -base64 32` |
| `GEMINI_API_KEY` | `AQ.Ab8RN6KBe0B3flZqZApWdEST5pGFq9o7inSzq9wavzUxOhdC2w` | Já configurada |
| `CRON_SECRET` | Qualquer string longa e aleatória | `openssl rand -base64 32` |

> **Dica:** Para gerar valores aleatórios seguros, use o site [generate-secret.vercel.app](https://generate-secret.vercel.app/32)

### 3.3 Configurar os Cron Jobs

Após o deploy do serviço principal, crie 3 cron jobs no Render para os lembretes automáticos:

**Cron Job 1 — Manhã (8h BRT)**
- Name: `prospectafluxus-morning`
- Schedule: `0 11 * * 1-5`
- Command: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://SEU-DOMINIO.onrender.com/api/cron/send-reminder -d '{"window":"morning"}'`

**Cron Job 2 — Almoço (12h BRT)**
- Name: `prospectafluxus-lunch`
- Schedule: `0 15 * * 1-5`
- Command: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://SEU-DOMINIO.onrender.com/api/cron/send-reminder -d '{"window":"lunch"}'`

**Cron Job 3 — Fim do dia (17h BRT)**
- Name: `prospectafluxus-evening`
- Schedule: `0 20 * * 1-5`
- Command: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://SEU-DOMINIO.onrender.com/api/cron/send-reminder -d '{"window":"evening"}'`

> Substitua `SEU-DOMINIO` pelo domínio gerado pelo Render (ex: `prospectafluxus-abc123.onrender.com`)

---

## Etapa 4 — Primeiro Acesso

### 4.1 Criar o primeiro usuário (admin)

1. Acesse `https://SEU-DOMINIO.onrender.com`
2. Clique em **"Criar conta"**
3. Preencha nome, email e senha
4. O primeiro usuário criado pode ser promovido a admin diretamente no banco

### 4.2 Promover usuário a admin (opcional)

No painel do Supabase, vá em **Table Editor → users** e altere o campo `role` de `user` para `admin`.

---

## Resumo das Variáveis de Ambiente

```
DATABASE_URL=postgresql://postgres:SENHA@db.xxx.supabase.co:5432/postgres
JWT_SECRET=string-aleatoria-longa
GEMINI_API_KEY=AQ.Ab8RN6KBe0B3flZqZApWdEST5pGFq9o7inSzq9wavzUxOhdC2w
CRON_SECRET=outra-string-aleatoria-longa
```

---

## Plano Gratuito — Limites

| Serviço | Limite gratuito | Suficiente para |
|---|---|---|
| Supabase | 500 MB banco, 2 GB transferência/mês | Centenas de leads |
| Render | 750h/mês (serviço dorme após 15min inativo) | Uso pessoal |
| Gemini API | 1.500 req/dia, 1M tokens/min | Dezenas de sugestões/dia |

> **Atenção:** No plano gratuito do Render, o serviço "dorme" após 15 minutos sem acesso. O primeiro acesso após inatividade pode demorar ~30 segundos para "acordar". Para evitar isso, considere o plano pago ($7/mês) ou use um serviço de ping gratuito como [UptimeRobot](https://uptimerobot.com).

---

## Suporte

Em caso de dúvidas, verifique os logs no painel do Render em **Logs** e consulte a documentação:
- Render: https://render.com/docs
- Supabase: https://supabase.com/docs
- Gemini API: https://ai.google.dev/gemini-api/docs
