# Relatório do colaborador — Feedback EEC

Pedido de 03/11/2026: reunir o resultado do Feedback em um relatório para mostrar ao colaborador e imprimir/salvar em PDF, sem alterar avaliações ou liberar acesso automaticamente.

- [x] Um relatório de leitura contém colaborador, avaliador, ciclo, período, etapa/revisão, soma das notas, referência esperada, máximo e média; notas por competência e EEC preenchido aparecem no mesmo relatório, com linguagem de desenvolvimento.
- [x] O relatório é encontrado por um botão visível na avaliação e a prévia apresenta o mesmo resumo e conteúdo. Abrir o relatório com edição não salva exige salvar antes, sem substituir o rascunho.
- [x] Uma página protegida de relatório tem botão Imprimir / Salvar PDF; a impressão A4 usa fundo branco, texto legível, não inclui editor, navegação, formulários nem controles de avanço/liberação.
- [x] Reusar o GET autorizado e a fórmula compartilhada; zero é nota real, ausência não vira zero, parcial/rascunho e não liberado são identificados. Evidência, Efeito, Conselho e anotações continuam opcionais.
- [x] Colaborador só acessa sua versão liberada; correção aguardando liberação não mostra conteúdo, totais nem impressão. Não criar endpoint público, exportar todas as pessoas, abrir papéis ou alterar liberação/ciência.
- [x] Conferir componentes, cálculos e impressão com dados sintéticos: TypeScript, 273 testes aprovados / 2 Gemini ignorados e build de produção aprovados. PDFs sintéticos de 5 e 6 páginas em A4 preservaram totais, textos e a última competência, sem navegação/controles; conferência visual de resumo e texto longo aprovada.
- [x] Publicar no Google e confirmar a revisão e os assets servidos antes de declarar produção. Confirmado em 11/11/2026: PR #39 integrado, deploy GitHub Actions 43092581481 concluído com sucesso, revisão `prospectafluxus-00006-rx8`, commit `cc1e48f9c7fe20d9fa0b88776a1cda59b004ac45`. Os hashes dos módulos JS/CSS públicos coincidem com os artefatos locais testados e estão referenciados pelo bundle/HTML atual. Rota retorna o shell HTTP 200; consulta de feedback sem login retorna HTTP 401.

## Implementação

Rota `/fluxus/feedback/avaliacao/:id/relatorio`, dentro do shell autenticado Persona. `FeedbackReport.tsx` separa documento puro e página; a prévia reutiliza esse documento, com soma calculada sobre os mesmos itens visíveis pela fórmula compartilhada. O botão Ver relatório / PDF da avaliação exige salvar alterações antes de navegar; o relatório usa a revisão salva. O botão Imprimir / Salvar PDF abre o diálogo do navegador, onde se escolhe Salvar como PDF ou uma impressora. Não há serviço externo de geração, link público ou nova mutação. O GET existente preserva a auditoria normal de leitura e, quando aplicável, o primeiro acesso do participante.

O teste existente de checkboxes foi delimitado ao bloco original de CSS para não considerar as novas regras independentes do relatório; seus critérios de visibilidade e contraste não foram relaxados. A nova rota entrou na cobertura de escopo Persona.

Diagnóstico: esta tarefa não tem projeto Webdev vinculado; reusar TypeScript/Vitest e o deploy GitHub Actions existente, sem reinicializar infraestrutura. Nenhuma avaliação real foi alterada para validar a funcionalidade.
