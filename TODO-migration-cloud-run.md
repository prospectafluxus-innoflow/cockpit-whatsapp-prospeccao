# TODO — migração para Google Cloud Run

Atualizado em 22/10/2026, após a primeira publicação automática e a ativação do agendador.

## Aplicação e publicação

- [x] Publicar Prospecta e Persona em https://prospectafluxus-664809259352.us-west1.run.app, preservando o mesmo PostgreSQL e storage Supabase.
- [x] Manter o Feedback EEC habilitado e publicar a alteração de avaliador já implementada, sem alterar participantes, ciclos, permissões ou avaliações durante os testes de migração.
- [x] Usar 1 vCPU, 512Mi, mínimo zero e máximo configurado de uma instância no serviço e na revisão. Esses parâmetros reduzem consumo, mas não são um teto mensal de cobrança.
- [x] Separar contas técnicas de build, runtime e deploy. Preservar as nove referências de secrets e suas permissões restritas no Secret Manager.
- [x] Criar alerta mensal de R$ 30 na conta de faturamento autorizada. O alerta não impede cobranças.
- [x] Conferir health público, HTML e bloqueio de dados de feedback sem login. O login próprio por e-mail/senha permanece; não foi introduzida dependência de OAuth externo.
- [x] Executar TypeScript, build e 248 testes unitários; dois testes externos permaneceram pulados.

Revisão de produção confirmada: `prospectafluxus-00003-llh`, com 100% do tráfego e label de código `20f419bca0af95c39282660c19158c3c0f8f74c2`.

## Implantação contínua

- [x] Integrar o PR #36 e executar o primeiro GitHub Actions até sucesso: https://github.com/prospectafluxus-innoflow/cockpit-whatsapp-prospeccao/actions/runs/39866951576.
- [x] Restringir Workload Identity Federation aos IDs numéricos do repositório e proprietário, branch `main`, workflow exato e eventos `push`/`workflow_dispatch`. Não há chave permanente de conta técnica.
- [x] Preservar env/secrets e IAM público nas próximas publicações. O workflow não executa migrations nem recria o Scheduler.
- [x] Excluir `gha-creds-*.json` do Git, Docker e pacote Google. Os identificadores públicos do provider/conta técnica têm defaults no workflow; não dependem de permissões para editar variáveis GitHub.

## Lembretes

- [x] Criar apenas um Cloud Scheduler: `fluxus-reminders-hourly`, cron `0 * * * *`, fuso `America/Sao_Paulo`, destino `/api/cron/dispatch-reminders` no Google.
- [x] Respeitar o horário e a habilitação de cada janela cadastrada por usuário, em vez de quatro horários globais fixos.
- [x] Aplicar somente a migration operacional `cloud_run_reminder_dispatch_ledger`, com RLS e unicidade por usuário/data local/janela. Não houve migration de conteúdo de Persona.
- [x] Conferir dry-run HTTP e execução pelo próprio Scheduler com HTTP 200, sem enviar notificações ou gravar claims de teste.
- [x] Habilitar o corpo real `{"dryRun":false}` somente depois do teste aprovado. Scheduler está `ENABLED`, com retries desativados para evitar reenvio automático ambíguo.
- [x] Usar links absolutos para o Google nas notificações. A entrega depende de canal disponível e da permissão Web Push do usuário.

A reserva é at-most-once por usuário/data/janela: falhas ou entrega ambígua não liberam automaticamente nova tentativa. O ledger registra resultado sem guardar nomes de leads ou credenciais. Não foi feito um teste de envio real a usuários.

## Site da Innoflow

- [x] Confirmar recuperação de `www.innoflow.com.br`: principais imagens, Blog e Colaborador responderam HTTP 200.
- [x] Confirmar que Área do Cliente e Persona, no desktop e mobile, apontam para o Google; Colaborador continua em `/colaborador`.
- [x] Respeitar a publicação Netlify reservada à usuária. Não fizemos rollback nem upload de uma nova publicação Netlify.

O deploy incompleto das 19h16 continha somente um arquivo no inventário do Netlify; a recuperação posterior foi confirmada. Não foi comprovado por que o upload da pasta informado pela usuária resultou naquele inventário. O favicon ainda retornava 404 na verificação de recuperação; as páginas e imagens principais não apresentavam essa falha.

## Integrações preservadas e pendências reais

- [x] Validar por leitura o bucket S3 e o prefixo de áudio do Supabase, sem upload, exclusão ou alteração de mídia. Não existem modelos com `audioKey` nem objetos no prefixo `audio/` para testar reprodução de áudio já cadastrado.
- [x] Manter WaBlast desabilitado e sua fila pausada, exatamente como na origem. Nenhum WhatsApp foi enviado; callback externo do provedor não foi reconfigurado nem declarado como validado.
- [ ] Validar login real da administradora e dos clientes no domínio Google. Cookies do Railway não são compartilhados; o navegador ainda apresentava a tela de login.
- [ ] Resolver as duas conexões Trello existentes: a chave configurada não decifra as credenciais armazenadas (AES-GCM rejeitou a autenticação). Não foi gerada nova chave de integração nem alterado o cadastro dessas conexões. É necessário recuperar a chave original correta ou reconectar cada integração pelo mecanismo protegido, com a identidade adequada. Não é possível atribuir esse problema exclusivamente à migração sem validar a origem.
- [ ] Validar reprodução/upload de áudio pela interface quando houver mídia e sessão real. Bucket acessível não substitui essa verificação.
- [ ] Reativar permissões de notificações no novo domínio conforme necessário. As inscrições antigas foram preservadas, mas não foi simulada aceitação de permissão pelo usuário.
- [ ] Reconfigurar e validar o webhook WaBlast no provedor antes de uma futura habilitação de envios. Não ativar a fila automaticamente durante a migração.
- [ ] Encerrar Railway apenas depois da validação real das integrações e autorização específica. O serviço antigo e o faturamento/subscrição permanecem intactos.

Domínio próprio para Prospecta/Persona é uma decisão opcional posterior; o site da Innoflow já usa seus links funcionais do Google. Não é necessário migrar o site institucional ou a área Colaborador para concluir a hospedagem da aplicação.
