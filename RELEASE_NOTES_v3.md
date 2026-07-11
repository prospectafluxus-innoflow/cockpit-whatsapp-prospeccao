# ProspectaFluxus v3 — Notas de Entrega

**Branch:** `feature/audio-push-trello`  
**Data:** 11 de julho de 2026  
**Estado:** pronta para revisão; ainda não integrada nem publicada em produção.

## Visão geral

Esta versão acrescenta os três módulos solicitados sem remover o fluxo atual de prospecção: **áudio opcional por toque**, **alertas reais no navegador e no telemóvel** e **integração idempotente com o Trello para leads respondidos**.

| Módulo | Resultado |
|---|---|
| Áudio | Cada um dos três toques aceita upload, reprodução, substituição e remoção de áudio privado. No telemóvel, a aplicação oferece partilha nativa; no computador, disponibiliza download e abre o contacto no WhatsApp Web. |
| Alertas | Os temporizadores locais foram substituídos por Web Push persistente. O perfil mostra estado real, teste e desativação por dispositivo, com instruções específicas para iPhone. |
| Trello | A configuração fica cifrada no backend. O cartão é criado somente quando o lead entra em **Respondeu**, com deduplicação local, remota e concorrente. Falhas permitem reintento no Kanban. |

## Alterações complementares

A importação Excel deixou de usar o parser vulnerável `xlsx` e passou para `read-excel-file`, preservando múltiplas folhas, cabeçalhos flexíveis e lotes de 50. As dependências diretas e transitivas foram atualizadas, a configuração do pnpm foi normalizada e os exemplos de deploy deixaram de conter valores sensíveis.

As migrações `0004` a `0007` são aditivas. Elas acrescentam metadados de áudio, subscrições Web Push, configuração Trello cifrada, estado de sincronização dos leads e os índices correspondentes.

## Validação executada

| Verificação | Resultado |
|---|---|
| Instalação com lockfile congelado | Aprovada |
| Verificação TypeScript | Aprovada |
| Regressão Vitest | Aprovada |
| Build equivalente ao Railway | Aprovado |
| Migrações numa base PostgreSQL descartável | Aprovadas |
| Segunda execução das migrações | Sem duplicação de objetos |
| Auditoria de dependências de produção | Sem avisos críticos, altos ou moderados tratáveis após as correções |
| Pesquisa de segredos no código novo | Nenhum segredo novo incorporado |
| Revisão de whitespace | Aprovada |

## Variáveis novas

Antes do deploy, configurar no Railway os grupos necessários em `env.example.txt`:

| Função | Variáveis |
|---|---|
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Trello | `INTEGRATION_ENCRYPTION_KEY` |
| Áudio S3/R2 | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` e, quando necessário, `S3_FORCE_PATH_STYLE` |

O Trello não exige API key global no Railway: cada utilizador autorizado informa API key, token e URL da lista no Perfil. Esses valores são cifrados antes de serem guardados.

## Segurança obrigatória antes da produção

O repositório esteve público e o histórico anterior continha valores de configuração sensíveis. **Tornar o repositório privado novamente não revoga esses valores.** Antes de publicar a v3, é obrigatório:

1. Rodar `DATABASE_URL` no fornecedor PostgreSQL/Supabase e atualizar o Railway.
2. Gerar um novo `JWT_SECRET` se o valor exposto estiver ou tiver estado em uso.
3. Revogar e recriar quaisquer chaves de IA, email ou infraestrutura presentes em versões antigas.
4. Confirmar que os novos valores existem somente no painel de variáveis, nunca em ficheiros versionados.
5. Criar um backup verificável da base antes de `pnpm db:migrate`.

## Sequência recomendada de ativação

1. Rever e aprovar a branch sem merge automático.
2. Guardar backup da base e confirmar a rotação dos segredos expostos.
3. Configurar Web Push, cifragem Trello e armazenamento S3/R2 no Railway.
4. Executar `pnpm db:migrate` com a nova `DATABASE_URL`.
5. Integrar a branch e aguardar build e healthcheck.
6. Testar login, cockpit e importação Excel.
7. Ativar e testar um dispositivo Web Push.
8. Carregar um áudio de teste e validar a partilha.
9. Ligar uma lista Trello de teste e mover um lead controlado para **Respondeu**.
10. Repetir a ação para confirmar que não é criado um segundo cartão.

## Rollback

Se a aplicação falhar após a publicação, restaurar o deploy anterior no Railway. Como as migrações v3 são aditivas, não é necessário apagar imediatamente as novas colunas e tabelas. Se houver indício de alteração de dados, restaurar o backup da base em ambiente separado e comparar antes de qualquer substituição.

As instruções completas estão em `DEPLOY_RAILWAY.md`, `docs/manual-usuario.md` e `docs/caderno-tecnico.md`.
