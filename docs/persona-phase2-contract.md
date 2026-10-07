# Contrato de implementação — fase 2

Repositório: `/home/ubuntu/repos/cockpit-whatsapp-prospeccao`. Branch: `feature/persona-phase2-feedback-eec`.

Nenhuma publicação ou alteração de dados reais. Não modificar cálculos do Persona. Não criar outro banco produtivo. Schema de produção conferido por metadados: usuários, empresas, avaliações, privacidade, auditoria e devolutivas existem e correspondem ao código; tabelas da fase 2 ainda não existem. Baseline: TypeScript aprovado, 92 testes aprovados e 2 de Gemini ignorados. Não há recurso Webdev vinculado; usar os checks locais existentes, não criar uma aplicação substituta.

## Arquivos compartilhados

- `shared/feedback.ts`: catálogo, schemas de itens, validação, labels, estados, cálculos e consolidação.
- `drizzle/feedbackSchema.ts`: novas tabelas aditivas. Não alterar os enums/papéis atuais de users; o novo módulo tem memberships explícitos.
- `server/feedbackDb.ts`: serviço de organização/ciclos/feedback e transações, a implementar.
- `server/routers/feedback.ts`: router tRPC exportado `feedbackRouter`, a implementar.
- `server/routers.ts`: coordenador registra `feedback: feedbackRouter`.

## Política de acesso

Novos memberships explícitos, sem conceder acesso automático baseado em `users.role` ou `users.fluxusRole`. Plataforma admin pode operar bootstrap administrativo da empresa, mas isso não concede leitura de feedback. Conta ativa e empresa ativa obrigatórias. Usuário fluxus só pode usar sua empresa. Papel company_admin configura organização/ciclos; RH pode configurar somente se explicitamente atribuído. Leitura de conteúdo organizacional exige `canReadFeedback=true` e escopo. Gestor lê somente participantes atualmente sob sua gestão, sujeito à permissão vigente; autor histórico preservado, não concede acesso eterno após perda de função. Supergestor: departamentos de scopes explícitos, incluindo descendentes se habilitado. RH/company_admin com canReadFeedback têm escopo empresarial. Colaborador lê somente próprios registros liberados. Autor técnico não bypassa. Nenhum retorno inclui respostas/resultados Persona; elegibilidade exige completed+result válido, versão suportada, metadata consistente e pertence à mesma empresa.

Todas as mutações são transacionais, com audit log na mesma transação. Proteger concorrência com locks de ciclo/avaliação e revision CAS. Não sobrescrever avaliação liberada: corrigir com motivo, gravar revisão anterior e voltar a completed e exigir nova devolutiva, limpar releasedAt/firstViewedAt/acknowledgedAt para nova devolutiva/liberação/ciência. Colaborador pode ler informação de que há uma correção aguardando liberação (sem os novos itens ocultos); não expor versões anteriores com erro sem revisão específica.

## Tipos de resposta

Person: `{id:number,name:string|null,jobTitle:string|null,department:string|null,eligible:boolean,personaAssessmentId:number|null,eligibilityReason:string|null,evaluatorEligible:boolean}`.
FeedbackListEntry: `{id,cycleId,participantUserId,evaluatorUserId,status,revision,participantName:string|null,evaluatorName:string|null}`; sem items/listas completas até autorizado.

`feedback.workspace({companyId?:number})` retorna `{enabled:boolean,companyId:number|null,membership:FeedbackMembership|null,canConfigure:boolean,canReadContent:boolean,catalog:FeedbackCompetency[],settings:{competencyIds:string[],version:number}|null,departments:FeedbackDepartment[],people:Person[],assignments:FeedbackAssignment[],scopes:FeedbackManagementScope[],cycles:DevelopmentCycle[],feedbacks:FeedbackListEntry[],pendingCorrections:number}`. Lista de pessoas inclui escopo necessário; para gestor apenas própria equipe; administrador sem canRead vê dados operacionais mas nunca conteúdo/nota. Sem membership e sem bootstrap permitido, enabled=false e listas vazias. Colaborador recebe apenas próprios feedbacks já liberados e ciclos correspondentes; não recebe diretório da empresa. PLATFORM ADMIN com companyId explícito recebe metadados necessários ao bootstrap e não conteúdo.

`feedback.get({id:number})` retorna `{feedback:FeedbackEvaluation,cycle:DevelopmentCycle,participant:{id,name,jobTitle},evaluator:{id,name},calculation:ReturnType<typeof calculateFeedback>,canEdit:boolean,canTransition:boolean,isParticipant:boolean}`. Nunca retorna draft ao participante. Registrar leitura auditável; primeira visualização de participante apenas após release.

`feedback.history({participantUserId?:number,year?:number})` retorna `{entries:FeedbackHistoryEntry[],consolidation:ReturnType<typeof consolidateFeedback>}`. Default self; gestão exige permissão de conteúdo e escopo. Para colaborador considerar apenas registros liberados. plannedCount inclui ciclos efetivamente atribuídos à pessoa no ano (não todos os ciclos da empresa).

## Operações tRPC

- `bootstrapCompanyAdmin({companyId,userId})`: platform admin only; atribui company_admin com canReadFeedback=false. Sem publicação de permissões reais pelo agente.
- `setMembership({companyId,userId,role:FeedbackRole,canReadFeedback:boolean})`: somente company admin com trilha; guarda anterior por fim vigência e cria novo. Não alterar users.role/fluxusRole.
- `createDepartment({companyId,name,parentId?:number|null})`.
- `updateDepartment({id,name,parentId:number|null,active:boolean})`: validar mesma empresa e impedir loops.
- `assignEmployee({companyId,userId,departmentId:number|null,managerUserId:number|null,jobTitle?:string})`: valida diretórios/gestor, fecha vínculo anterior e cria histórico, impede self/loops liderança.
- `setManagementScope({companyId,userId,departmentId,includeDescendants:boolean,active:boolean})`: apenas roles autorizadas, mesmo tenant, histórico.
- `updateSettings({companyId,competencyIds:string[]})`: catálogo fechado, versão incrementada, nenhuma avaliação alterada.
- `createCycle({companyId,name,startsOn:string,endsOn:string})`: ISO dates reais, fim>=início; year derivado startsOn; snapshot e versão dos settings do servidor. Se settings ausentes, usar dez padrão versão1.
- `addParticipants({cycleId,participants:Array<{userId:number,evaluatorUserId:number}>})`: somente planned, exige Persona completo válido, assignment atual, avaliador autorizado com permissão e vínculo/escopo, não permitir self. Atomicidade do lote.
- `removeParticipant({cycleId,userId})`: somente planned/draft; registrar exclusão operacional na auditoria.
- `transitionCycle({id,status:'active'|'closed'|'cancelled'})`: transições padrão; ativo exige participantes, elegibilidade revalidada e autorização dos avaliadores. Encerrar exige todos feedbacks closed (não force fechar ciência).
- `saveDraft({id,revision,items:FeedbackItem[]})`: apenas avaliador autorizado/current company scope, cycle active, status draft.
- `transition({id,revision,status:'completed'|'debriefed'|'released'|'acknowledged'|'closed'})`: sequência estrita; complete exige todos EEC; ciência somente participante; close avaliador. firstViewedAt não é ciência. Gestor não se substitui ao colaborador.
- `correct({id,revision,reason:string,items:FeedbackItem[]})`: avaliador autorizado, cycle active, status completed/debriefed/released/acknowledged; full valid items + reason; se released/acknowledged nova devolutiva necessária, preservar revision anterior, participante vê aviso de correção sem conteúdo novo até release.
- `comment({id,comment:string})`: participante após release, sem alterar nota; campo opcional não exigido para ciência.

## Frontend

Páginas `/fluxus/feedback`, `/fluxus/feedback/ciclo/:id`, `/fluxus/feedback/avaliacao/:id`, `/fluxus/feedback/historico`; organização integrada em aba no workspace. Reutilizar auth/layout/cores/logo atuais. Todos veem entrada Feedback que resolve permissão pelo workspace. Admin técnico pode abrir `/fluxus/admin/feedback/empresa/:id` sob DashboardLayout; link na empresa existente, opção bootstrap sem leitura automática. API sempre protege, não confiar em esconder botões.

Usar controles reais e estados de carregamento/erro com retry. Não criar dados fictícios em produção. Seleção catálogo10 com descrição. Datas sugestão trimestral, configuráveis. Participantes inelegíveis visíveis com motivo e seleção bloqueada. Rascunho/complete/debrief/release separados, confirmações claras no app para release e alterações de papéis. Preview do colaborador exibe mesmos itens/notas e labels acolhedores. Ciência com texto explícito sem renúncia/concordância. Dicas EEC sem IA. Histórico possui seletor ano, tabela competências e links às evidências por avaliação; pendentes não são zero e comparabilidade sinalizada.

## Limites

Sem 1:1, combinados, importação legado, IA, criação livre competências/pesos, ranking ou novo sistema de notificações. Usar os detalhes operacionais propostos na conversa (EEC obrigatório na conclusão e escala por faixas); documentar como escolhas da primeira versão ajustáveis após revisão, não como decisões históricas irrevogáveis.
