# Governança, visibilidade e LGPD — Fluxus Persona

**Autor:** Manus AI  
**Versão:** 1.0  
**Data:** 19 de setembro de 2026

## Objetivo

Este documento define controles técnicos e operacionais para o tratamento de dados do Fluxus Persona. Ele complementa a documentação metodológica e não substitui a validação jurídica da empresa controladora, do encarregado pelo tratamento de dados ou de assessoria especializada.

A plataforma deve observar finalidade, adequação, necessidade, transparência, segurança, prevenção, não discriminação e responsabilização. O resultado comportamental é dado pessoal de alto impacto no contexto de trabalho, embora não seja automaticamente uma categoria de dado pessoal sensível. Seu uso deve permanecer limitado ao desenvolvimento declarado e sujeito a revisão humana.[1]

## Papéis e visibilidade

| Papel | Acesso padrão | Restrições |
| --- | --- | --- |
| Participante | Próprio cadastro, respostas, ciclos, resultados, consentimentos e pedidos de privacidade | Não acessa dados de terceiros ou agregados da empresa por padrão |
| Gestor | Dashboard agregado da própria empresa | Não recebe respostas brutas; relatório individual depende da política da empresa e de finalidade autorizada |
| RH | Dashboard agregado da própria empresa e administração de pessoas autorizada | Não recebe segredos, respostas brutas ou indicadores clínicos; todo acesso individual deve ser justificado |
| Administrador da plataforma | Gestão operacional de empresas, papéis e suporte | Acesso individual é excepcional, minimizado e auditado; hashes e tokens nunca são serializados |

O servidor aplica o limiar mínimo antes de serializar médias. Grupos abaixo do limiar recebem apenas o estado “dados insuficientes”. Gestores e RH não recebem listas de resultados individuais no endpoint agregado. Contagens liberadas ao dashboard são apresentadas em faixas.

## Finalidade e consentimento

O cadastro registra a versão do aviso, a finalidade, data e hora, origem e hashes do user-agent e do endereço de rede. Esses hashes servem apenas à prestação de contas e não devem ser usados para rastreamento.

O texto padrão de finalidade é: **autoconhecimento, devolutiva e desenvolvimento profissional, sem decisão automatizada**. A empresa pode configurar uma finalidade mais específica, desde que permaneça compatível com o produto e seja informada aos participantes.

A revogação de consentimento gera um pedido formal e interrompe usos baseados nesse consentimento. A revogação não elimina automaticamente dados cuja conservação possua outra base legal válida; nesses casos, a resposta ao titular deve informar o motivo, o escopo bloqueado e o prazo de revisão.[1]

## Direitos dos titulares

A central de privacidade permite consultar consentimentos, finalidade, retenção, compartilhamentos e pedidos. O participante pode exportar seus dados em formato JSON e registrar solicitações de acesso detalhado, correção, revogação ou exclusão.

Cada solicitação recebe protocolo, estado e data. Pedidos de exclusão exigem análise porque podem resultar em eliminação, anonimização ou bloqueio. O processo deve considerar obrigações legais, prevenção a fraude e exercício regular de direitos. A ANPD mantém orientações sobre confirmação, acesso, correção, eliminação, portabilidade, informação e revisão de decisões automatizadas.[2]

## Retenção

A configuração da empresa define o prazo organizacional, entre 6 e 120 meses. O valor padrão técnico é 60 meses, mas não representa prazo legal universal. Antes do uso em escala, o controlador deve aprovar prazos por finalidade.

Como referência operacional, rascunhos inativos devem ser revistos em 90 dias; avaliações concluídas devem ser revisadas em até 24 meses após a conclusão ou o fim da relação contratual; logs de acesso podem usar 12 meses como baseline; backups devem seguir janela rotativa documentada. Exceções precisam de finalidade, responsável, prazo e acesso restrito.

## Auditoria

A plataforma registra os seguintes eventos sem guardar o conteúdo protegido: aceite e revogação, início de ciclo, leitura do próprio relatório, leitura administrativa, consulta de agregado, exportação, alteração de papéis, mudança de política, pedido de privacidade e salvamento de devolutiva.

Cada evento contém ator, sujeito quando aplicável, empresa, avaliação, ação, recurso, metadados mínimos, hash de rede e instante. Senhas, tokens, respostas, resultados completos, e-mail completo e conteúdo da devolutiva não devem ser gravados no log.

## Devolutiva responsável

A devolutiva segue sete etapas: finalidade, limites, evidências, hipóteses, voz do participante, acordo de ações e acompanhamento. O facilitador deve priorizar no máximo duas ações observáveis. Divergências e discordâncias são registradas como contexto, não como resistência ou falta de autoconhecimento.

Energia e autorregulação são autorrelatos contextuais. Não devem ser tratados como diagnóstico, risco clínico ou avaliação de estabilidade emocional. Se a conversa revelar situação de saúde ou sofrimento, o gestor deve interromper a interpretação do instrumento e encaminhar para o canal profissional adequado.

## Relatórios e PDF

O PDF do participante contém todas as seções de autodesenvolvimento, identidade InnoFlow, datas, versões e aviso de confidencialidade. O PDF do gestor acrescenta preparação de conversa e permanece sujeito à política de visibilidade. Nenhum PDF deve conter senha, token, hash, resposta bruta, identificador interno ou dado desnecessário.

A emissão usa a função de impressão do navegador com layout A4 e todas as seções renderizadas em uma versão específica para impressão. O arquivo permanece no dispositivo escolhido pelo usuário; a plataforma não cria URL pública permanente.

## Segurança e incidentes

Contas pendentes, rejeitadas ou marcadas como excluídas são bloqueadas em todas as rotas protegidas. Mudanças futuras devem incluir sessões persistidas e revogáveis, autenticação reforçada para exclusão e exportação, proteção contra requisições cruzadas e revisão periódica de acessos privilegiados.

Incidentes com risco ou dano relevante devem seguir processo de detecção, contenção, investigação, documentação e comunicação. A ANPD mantém regras e canal específicos para comunicação de incidentes de segurança.[3]

## Revisão e evidências

A política deve ser revista quando mudar a finalidade, o instrumento, a fórmula, a empresa controladora, o fornecedor, a audiência ou o tipo de dado tratado. O controlador deve manter Registro das Operações de Tratamento e avaliar a necessidade de Relatório de Impacto à Proteção de Dados Pessoais antes do uso em escala.[4]

## Referências

[1]: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm "Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais"
[2]: https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares "ANPD — Direito dos Titulares"
[3]: https://www.gov.br/anpd/pt-br/assuntos/comunicacao-de-incidentes-de-seguranca-cis "ANPD — Comunicação de Incidentes de Segurança"
[4]: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd "ANPD — Relatório de Impacto à Proteção de Dados Pessoais"
