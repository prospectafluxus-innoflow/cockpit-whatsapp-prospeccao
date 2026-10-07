# Plano de implementação — Fluxus Persona fase 2

## Contexto e limites

Evoluir o aplicativo existente, preservando a stack, o PostgreSQL/Supabase e os cálculos Persona. Código base em `c4d0a0b`; branch `feature/persona-phase2-feedback-eec`. Schema de produção conferido somente por metadados em 06/10/2026 e consistente nas entidades existentes. Não há tabelas de organização, desenvolvimento ou feedback. Baseline TypeScript e 92 testes aprovados; dois testes de Gemini já ignorados.

O usuário autorizou desenvolver Feedback EEC com dez competências padronizadas selecionáveis pela empresa, Persona concluído como elegibilidade, ciclos sugeridos trimestrais, histórico e consolidação. Administrador configura o processo, não escala/pesos/fórmulas/competências próprias. Visão do colaborador acolhedora, mas com mesmos fatos/notas da gestão; revisão humana, ciência sem concordância e manifestação opcional. 1:1 e combinados ficam para fase seguinte.

Sem DDL/DML ou alterações de permissões em produção nesta etapa. O novo módulo terá feature flag `FLUXUS_FEEDBACK_ENABLED`, desativada por padrão; bootstrap de papéis explícito, não automático. A migração terá comando específico, não será inserida na rotina automática de startup. A entrega será uma PR de revisão, sem merge para main.

## Implementação e estrutura

`shared/feedback.ts` fornece catálogo estável versionado, schemas EEC, cálculo 0–6/referência5, transições, labels e consolidação de ciclos comparáveis. `drizzle/feedbackSchema.ts` contém novas tabelas de memberships, departamentos, vínculos históricos, escopos, configurações, ciclos, avaliações e revisões. `drizzle/0011_fluxus_feedback_eec.sql` implementará a migração aditiva; `scripts/migrate-feedback.mjs` aplicará sob controle explícito e com verificação do destino.

`server/feedbackDb.ts` concentra autorização por tenant, membership vigente e escopo, operações transacionais e auditoria. `server/routers/feedback.ts` valida inputs com Zod e expõe `feedback` em tRPC. Alterações em hierarquia são históricas; avaliações preservam o contexto de criação; transições e atualizações possuem locks e revisão otimista. Papéis técnicos administram cadastro, sem bypass de conteúdo. A elegibilidade consulta metadados da análise, mas não expõe respostas ou resultado.

As páginas em `client/src/pages/FluxusFeedback*` e componentes em `client/src/components/feedback` usam o contrato em `docs/persona-phase2-contract.md`. Navegação se integra a FluxusLayout; administração técnica de bootstrap fica em DashboardLayout na empresa correspondente. Não introduzir interfaces substitutas ou novo projeto de hosting.

Testes de domínio e backend são integrados ao Vitest existente. Migração e fluxo integrado serão exercitados em PostgreSQL descartável no sandbox, sem conectar ao Supabase para operações de escrita. Ferramentas Webdev foram consultadas, mas não há recurso vinculado e GET runtime/post-edit informou No active project; usar pnpm check como diagnóstico local, sem inicializar uma aplicação nova.

## Experiência visual

Preservar a identidade existente: interface editorial de produto B2B, marca Fluxus Persona, verde/teal, superfícies slate e fundo claro ou escuro conforme tema. Hierarquia focada em ciclo, pessoa e competências; cards apenas como apoio, não dashboard decorativo. Tipografia e logo são os existentes. Elementos de assinatura: indicação explícita do ciclo, trilha de estados do feedback e bloco EEC com orientação contextual.

Interação guiada e progressiva: configurar, selecionar, revisar e ativar. Diferenciar salvar rascunho, concluir, registrar devolutiva e liberar. A visão do colaborador utiliza títulos respeitosos, mantém escala/fatos acessíveis e mostra ciência sem renúncia. Estados de erro têm mensagem e retry; nada de carregamento infinito. Teclado, labels de campos e contraste apropriados. Animações somente discretas dos componentes existentes, sem transições que atrapalhem preenchimento. Tom: claro, respeitoso e factual; exemplos: “Descreva o fato observado, não um rótulo pessoal” e “Registrar ciência não significa concordância”.

## Escolhas operacionais

Para a primeira implementação, rascunho pode ser incompleto e conclusão exige nota+Evidência+Efeito+Conselho em todas competências. Classificação automática por faixas: 0–3 desenvolvimento, 4–5 construtiva/satisfatória, 6 positiva/surpreendente. São os padrões propostos na conversa; podem ser ajustados na revisão metodológica antes da produção sem conceder criação livre aos clientes. Notas ausentes não viram zero.

Consolidação conta ciclos concluídos, exclui cancelados e sinaliza incompletude. Não somar scores Persona ao Feedback. Competências ou versões diferentes tornam totais não diretamente comparáveis. Alteração pós-liberação exige motivo, trilha de revisão e nova devolutiva/liberação/ciência. Retenção e políticas jurídicas serão revisadas antes de habilitar em clientes reais.
