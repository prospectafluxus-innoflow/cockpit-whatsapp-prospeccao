# TODO — migração para Cloud Run

## Resultados reais deste trabalho

- Entrypoint de produção valida `PORT` como porta decimal entre `1` e `65535`, falha rápido quando ausente/inválida e escuta exatamente em `0.0.0.0` sem procurar portas alternativas.
- `GET /api/health` responde `200 {"ok":true}` sem consultar ou devolver secrets.
- `.dockerignore` mantém `.env*`, `.git`, credenciais/chaves privadas, testes e tooling local fora do contexto; source necessário para o build permanece incluído.
- A imagem não copia migration para o runtime.
- `scripts/deploy-cloud-run.sh` foi preparado para `project`, `region` e `service`, com `min=0`, `max=1`, `1 vCPU`, `512Mi`, CPU request-based e serviço privado inicialmente. Secrets entram somente como referências do Secret Manager vindas de configuração protegida.
- O script não executa migrations, não cria cron jobs/webhooks e não altera o comportamento do Persona ou do Trello.
- O guia foi corrigido para não prometer custo zero, separar `vCPU-s` de `GiB-s` e documentar `Authorization: Bearer <CRON_SECRET>` com `window`.

## Pendências antes de um corte definitivo

- **Credenciais/configuração:** fornecer, por mecanismo protegido, os nomes dos secrets e conceder `roles/secretmanager.secretAccessor` à service account de runtime. Nenhuma credencial real foi recebida ou testada neste trabalho.
- **Auth callback:** confirmar `OAUTH_SERVER_URL`, `VITE_APP_ID`, URLs de callback e cookies no domínio Cloud Run; testar login completo antes de liberar `allUsers`.
- **Supabase:** confirmar conectividade, pool/SSL e executar migrations somente em procedimento separado, revisado e com rollback. O deploy preserva `DATABASE_URL` e não escreve no banco.
- **Storage:** validar a dependência existente de `/manus-storage/*`/Manus Forge, URLs assinadas, persistência e comportamento sem filesystem local durável.
- **Trello — bloqueio de corte:** o fire-and-forget foi corrigido: `queueLeadTrelloSync` retorna `Promise<void>` e as mutations aguardam o sync antes de responder, com falhas ainda toleradas e log sanitizado. Validar a integração real (entrega, retry, observabilidade e comportamento em cold start/terminação do Cloud Run) antes de considerar o corte definitivo.
- **Cron/webhooks:** decidir IAM e provisionamento manual posterior. O cron exige `Authorization: Bearer <CRON_SECRET>` e `window`; webhooks WaBlast não são registrados nem tornados públicos automaticamente.
- **Exposição pública:** validar health, secrets, auth, Supabase e integrações no serviço privado; só então decidir o binding `allUsers`.

## Estado confirmado em 22/10/2026 após publicação

- [x] Faturamento do projeto ativo e alerta mensal de R$ 30 criado (não é limite rígido).
- [x] APIs Run/Build/Artifact Registry/Secret Manager habilitadas.
- [x] Contas técnicas separadas e 9 secrets protegidos, com 15 configurações públicas/vazias preservadas.
- [x] Build/deploy privado concluído; revisão `prospectafluxus-00001-lwg` pronta.
- [x] Smoke privado read-only com 9 verificações aprovado.
- [x] Exposição pública da aplicação liberada após validação; HTTP 200 no endereço e health, HTTP 401 para feedback sem login.
- [x] Código atual de edição de avaliador confirmado no chunk de feedback servido pelo Google.
- [ ] Login real dos usuários no novo domínio, sem compartilhar cookies do domínio antigo.
- [ ] Transferir/validar lembretes, webhooks e links já distribuídos sem duplicar execuções.
- [ ] Validar Trello e reprodução de áudios com uma sessão real; testes automáticos não substituem validação da integração.
- [ ] Decidir domínio próprio e implantação contínua no Google para futuros commits.
- [ ] Desativar Railway somente após a transição completa e autorização específica; serviço antigo preservado.

Endereço público confirmado: https://prospectafluxus-664809259352.us-west1.run.app
