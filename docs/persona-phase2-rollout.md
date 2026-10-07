# Fluxus Persona — fase 2: implementação e habilitação

## Estado e escopo

Esta branch implementa a primeira versão do Feedback Estruturado EEC na aplicação existente. Não é uma publicação de produção. O Supabase de produção foi consultado somente para conferir metadados de schema; não foram criados ciclos, usuários, permissões ou tabelas em clientes reais.

O módulo contém catálogo fechado de dez competências, configuração por empresa, departamentos/subdepartamentos, vínculos históricos, papéis explícitos, escopos, ciclos e participantes, formulário EEC, devolutiva, liberação, ciência, comentários, correções auditadas e consolidação por ano. O 1:1 permanece fora desta fase. O Persona e o Feedback continuam sendo instrumentos separados.

O código foi dividido em domínio compartilhado, schema, serviço de backend, router e componentes de workspace/organização, ciclo, avaliação, histórico e administração técnica. O frontend usa os tipos inferidos do tRPC real, não um contrato simulado.

## Política da primeira versão

O administrador empresarial escolhe uma a dez competências do catálogo. Não há criação livre de competências, pesos, escala, fórmula ou formulário. Cada ciclo preserva a definição e versão das competências; mudar a seleção da empresa afeta somente ciclos futuros. Para facilitar comparações, recomenda-se manter o mesmo modelo no ano.

O participante precisa de uma análise Persona concluída válida e um vínculo organizacional vigente. Não há prazo de validade da análise nem exigência de responder outro Persona em cada trimestre. Uma análise nova não invalida a referência válida já registrada num ciclo planejado. O avaliador precisa de papel, permissão de leitura e escopo vigentes; não precisa ter concluído seu próprio Persona para avaliar outra pessoa.

Rascunhos podem ser incompletos. Na primeira versão, a conclusão exige nota e Evidência/Efeito/Conselho em todas as competências. A escala é 0–6 e a referência é 5 por competência; a classificação proposta é 0–3 desenvolvimento, 4–5 construtiva/satisfatória e 6 positiva/surpreendente. **Obrigatoriedade dos três textos e faixas/rótulos são padrões de implementação para revisão metodológica antes da produção, não configurações livres por cliente.**

Salvar ou concluir não libera o feedback. A sequência é rascunho → conclusão → devolutiva realizada → liberação → ciência do colaborador → encerramento. Primeira visualização e ciência possuem eventos separados. Ciência não implica concordância ou renúncia. A manifestação é opcional e não altera a nota.

Correções após conclusão exigem motivo e avaliação completa; preservam o registro e os metadados anteriores e reiniciam na conclusão, exigindo nova devolutiva/liberação/ciência. O participante recebe aviso de revisão pendente, sem acesso antecipado aos novos itens. A manifestação anterior fica preservada no snapshot da revisão; não é tratada como manifestação sobre o conteúdo novo.

Gestores e supergestores dependem de escopo atual. Ser autor histórico não mantém acesso depois da perda do escopo. RH e administrador empresarial somente leem conteúdo com permissão explícita. O administrador técnico pode iniciar o cadastro do administrador empresarial com leitura desativada; não pode usar o endpoint de memberships para conceder permissões de conteúdo. A definição dos demais papéis/permissões é do administrador empresarial.

O histórico mostra apenas feedbacks liberados ao próprio participante ou conteúdo dentro do escopo organizacional autorizado. Ciclos cancelados ou pendentes não viram notas zero. O acumulado é parcial enquanto houver ciclos atribuídos pendentes; modelos diferentes são sinalizados como não diretamente comparáveis. Evidências mantêm ligação com seu ciclo/avaliação; a interface não inventa uma data da evidência.

A exportação pessoal existente foi complementada com feedbacks liberados. Rascunhos e revisões aguardando liberação não são automaticamente publicados na tela ou no pacote operacional; pedidos de acesso/correção sobre outros registros podem ser encaminhados pela Central de Privacidade. Essa restrição de interface não determina por si só o alcance dos direitos do titular.

## Migrações e feature flag

As tabelas da fase 2 são criadas por `0011_fluxus_feedback_eec.sql`; `0012_fluxus_feedback_revision_metadata.sql` acrescenta o snapshot dos metadados anteriores. Há FKs compostas para impedir referências entre empresas. As oito tabelas de dados do módulo têm RLS habilitada, sem políticas concedendo acesso REST a anon/authenticated. A aplicação deve usar sua conexão privilegiada de servidor e os guards tRPC; não usar uma chave de cliente para essas tabelas.

O runner usa transação, advisory lock, checksum e registro de migração. Não reescrever uma migração já aplicada; mudanças futuras devem ter outro arquivo versionado. As migrações da fase 2 usam o runner explícito, separado do journal legado do Drizzle. **Não usar `db:push` como substituto deste rollout.**

`FLUXUS_FEEDBACK_ENABLED` fica desativada por padrão. Sem a flag, o workspace é vazio e as outras operações retornam módulo não habilitado, sem consultar as tabelas novas. O novo comando de migração não foi inserido em `start:railway`.

## Reprodução dos testes locais

Usar somente um PostgreSQL local descartável com banco cujo nome comece por `persona_phase2_test`. A preparação não cria o banco ou seus usuários: criar previamente o banco local e informar a conexão sem salvar credenciais no Git. O PostgreSQL local precisa ter SSL disponível para o runner Fluxus legado; a validação ocorreu no PostgreSQL 16 instalado no Ubuntu.

```bash
export DATABASE_URL='postgresql://USUARIO_LOCAL:SENHA_LOCAL@127.0.0.1:5432/persona_phase2_test'
export FLUXUS_FEEDBACK_ENABLED=true
node scripts/prepare-feedback-test-db.mjs
pnpm test:feedback:integration
pnpm check
pnpm test
pnpm build:prod
```

Os scripts de integração recusam destinos remotos. Criam exclusivamente contas e empresas fictícias locais, sem enviar e-mails ou WhatsApp. O primeiro script guarda referências e credenciais dessas fixtures em arquivo temporário privado para o segundo; `FEEDBACK_TEST_FIXTURE_FILE` permite definir outro caminho. Não publicar esse arquivo. Não há reset/TRUNCATE global: cada execução cria sua própria empresa de teste. O script de segurança deve rodar depois do script de fluxo.

As validações cobrem o ciclo completo e quatro trimestres, EEC obrigatório, revisão concorrente, liberação/ciência, correção, snapshots, isolamento entre empresas/equipes, escopo com/sem descendentes, perda de escopo, rebaixamento de papel, membership futuro, conta/empresa inativa, Persona de referência e exportação pessoal. Os testes automáticos do Persona continuam no Vitest existente. Dois testes de Gemini já eram ignorados na baseline.

## Habilitação em produção — próxima etapa, não executada

Antes de habilitar, revisar esta PR e os dois padrões metodológicos indicados acima, validar os textos/políticas com os responsáveis trabalhista e de dados, escolher a empresa piloto e confirmar quem será seu administrador. Fazer backup verificável e testar a conexão de servidor/condições de rollback.

Depois da revisão e autorização do rollout, manter a flag desativada enquanto se aplica a migração explicitamente. O runner remoto exige confirmação do host e backup:

```bash
# DATABASE_URL vem do ambiente protegido, nunca de um valor gravado no repositório.
pnpm db:migrate:feedback --backup-confirmed --confirm-host=HOST_EXATO_DA_CONEXAO
```

Este comando não foi executado contra produção. Não fornece uma autorização automática para outro ambiente. A habilitação envolve disponibilizar o código aprovado, a feature flag e o bootstrap administrativo confirmado. Em seguida, o administrador empresarial define a organização e os acessos; não há conversão automática dos papéis antigos.

Para interromper a disponibilização do módulo, desativar a flag e retornar ao código aprovado anterior, conservando os registros. Não há migração destrutiva automática de rollback. A política de retenção e o atendimento de solicitações de acesso/correção/exclusão devem incluir as novas tabelas e revisões antes do uso em clientes reais.

Trocas organizacionais em ciclos planejados exigem revisar/remover e adicionar novamente a participação para registrar o vínculo correto antes da ativação. A autoria não é reatribuída silenciosamente. Antes de trocar gestor durante um ciclo ativo, concluir as pendências ou cancelar/replanejar o processo conforme a política da empresa; esta versão não inclui transferência de avaliações em andamento para outro autor.

Não houve teste visual de navegador nem publicação de Preview nesta entrega. A verificação desta branch é por inspeção, TypeScript, testes automáticos, integração real com PostgreSQL descartável e build. Permanecem os avisos preexistentes de analytics não configurado e chunk grande, sem falha de compilação.
