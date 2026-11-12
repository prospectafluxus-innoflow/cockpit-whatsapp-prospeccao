# Clareza e retorno da importação complementar — 12/11/2026

- [ ] Explicar que o colaborador pode importar os dois relatórios, separadamente, um PDF por vez: QP (relatório PQ_Assessment_Report) ou Sabotadores (Saboteur_Assessment_Results). Tipo, arquivo e consentimento devem corresponder a cada envio.
- [ ] Exibir andamento desde a leitura local até a resposta da API, impedindo dois cliques simultâneos.
- [ ] Mostrar erro persistente junto do envio, mantendo arquivo e escolhas para correção; não depender apenas de aviso temporário.
- [ ] Em caso de sucesso, atualizar Meus relatórios e conduzir foco/rolagem para a conferência na mesma página; esclarecer que ainda é necessário conferir e confirmar.
- [ ] Manter consentimento nominativo, dados privados, validação de nome/tipo, confirmação humana e revogação. Não reenviar PDFs reais ou aceitar termos pelo usuário durante diagnóstico/testes.
- [ ] Confirmar a publicação da correção no Google antes de instruir a usuária a atualizar a página.

## Evidência de diagnóstico

As duas tentativas recentes de upload retornaram HTTP 400 (requisições chegaram ao servidor). A mensagem exata da rejeição não estava disponível no print ou no navegador conectado; não atribuir a causa a nome, arquivo ou seleção sem evidência. Melhorar a visibilidade do erro primeiro. Testar somente com dados sintéticos/banco descartável.

## Motivo esclarecido pela usuária

Em 12/11/2026 às 00:31, a usuária informou que o PDF traz seu sobrenome de casada, enquanto o cadastro utiliza seu sobrenome de solteira. Isso é consistente com a validação atual de correspondência de nomes. Não alterar o cadastro, editar o PDF, importar em nome dela ou afrouxar a validação sem uma instrução específica. A melhoria desta entrega expõe a rejeição claramente e orienta o uso de nomes correspondentes.
