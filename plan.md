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

## Correção orientada pela usuária — administrador no cadastro existente

Em 06/10/2026, após a publicação autorizada da fase 2, a usuária solicitou: “usa o cadastro de colaborador que já tem e coloca a opção se é admin ou não, igual está se é gestor ou não”.

Incorporar uma opção sim/não “Administrador da empresa (Feedback)” na mesma lista de colaboradores e papéis da administração da empresa, sem pedir ID interno. Manter separadamente o papel Persona existente (Colaborador/Gestor/RH), sem migrar esses papéis ou liberar conteúdos automaticamente. O nome e a empresa da pessoa escolhida devem aparecer numa confirmação antes da alteração. Ativar atribui `company_admin` no Feedback com leitura automática desabilitada; desativar passa ao papel de colaborador do Feedback, também sem leitura organizacional, preservando histórico e o papel Persona. Exigir estado esperado para rejeitar alterações concorrentes, revalidar empresa/conta no servidor e restringir essa operação ao administrador técnico já autorizado. Reutilizar nomes e IDs do diretório existente; não criar endpoints de busca ou cadastros duplicados. Mostrar o estado verdadeiro e bloquear controles se não foi possível carregar o módulo. Não atribuir papéis reais nesta tarefa.

A entrada antiga da administração operacional direcionará ao cadastro existente. Destacar “Definir administrador” no caminho normal e usar textos de produto, sem “bootstrap” ou “membership”. Validar código e regressões em PostgreSQL local, revisar de forma independente e publicar a correção no mesmo repositório/Railway, sem migrações novas ou alterações em configurações de produção.

## Correção de clareza do administrador — 06/10/2026

A usuária não reconheceu a caixinha escura como controle e interpretou o rótulo repetido como todos administradores. Conferência somente leitura no banco mostrou nenhum membership vigente de Feedback na InnoFlow; o DOM mostrou os oito controles unchecked e habilitados. Substituir apenas o checkbox pelo seletor nativo Sim/Não, no estilo do Perfil Persona já existente. Valor sempre vem do banco; estado desconhecido mostra Carregando/Indisponível, nunca assume Sim/Não. Escolher valor diferente abre a confirmação já existente e cancelar preserva o valor salvo. Manter API, guard, histórico, auditoria e demais papéis sem mudanças; não alterar acesso real em produção durante a verificação. Publicar a correção e verificar a escolha de Sim seguida de cancelamento.

## Recuperação do seletor administrativo — 07/10/2026

A tela apresentou erro de consulta e todos os seletores Indisponível. A mesma sessão conseguiu consultar por GET o workspace nos formatos individual e lote, com estados booleanos válidos: bloqueio de consulta/cache, não admins concedidos nem sessão sem autoridade. Desacoplar o seletor da carga completa de workspace, que também consulta análises, departamentos, ciclos e avaliações. Uma query administrativa somente leitura retornará apenas empresa, habilitação e IDs/estado de administrador dos colaboradores ativos já cadastrados, usando os mesmos guards de conta, empresa e administrador técnico e a semântica de membership vigente mais recente. Não é busca nem novo cadastro. O seletor usará essa query leve, com duas tentativas limitadas para falhas transitórias, sem repetir erros de autorização, e sem refetch automático a cada foco da janela; estado esperado e locks continuam no servidor. Invalidar as duas consultas após mutação confirmada. Não atribuir nem remover papéis reais para testar.

## Reabertura do bloqueio pelo usuário — 07/10/2026

O usuário continua vendo Indisponível e Feedback não habilitado, apesar de a sessão acessível à tarefa carregar a versão #29 com estados válidos. Não declarar resolução definitiva com essa evidência parcial: obter URL/print do caminho real, solicitado em pergunta deferred, e revalidar nessa origem/conta. Railway confirma um domínio público e branch main. Independente dessa divergência, workspace usa enabled=false tanto para flag desligada quanto ausência de empresa/membership e a UI exibe uma mensagem única incorreta. Separar moduleEnabled e unavailableReason na resposta existente, mantendo enabled e todos os guards atuais, e orientar em linguagem de produto. Não conceder papéis para esconder o estado nem mudar autenticação. Reabrir o critério de produção até confirmar no caminho relatado.
