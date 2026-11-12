# Clareza e retorno da importação complementar — 12/11/2026

- [x] Explicar que o colaborador pode importar os dois relatórios, separadamente, um PDF por vez: QP (relatório PQ_Assessment_Report) ou Sabotadores (Saboteur_Assessment_Results). Tipo, arquivo e consentimento devem corresponder a cada envio.
- [x] Exibir andamento desde a leitura local até a resposta da API, impedindo dois cliques simultâneos.
- [x] Mostrar erro persistente junto do envio, mantendo arquivo e escolhas para correção; não depender apenas de aviso temporário.
- [x] Em caso de sucesso, atualizar Meus relatórios e conduzir foco/rolagem para a conferência na mesma página; esclarecer que ainda é necessário conferir e confirmar.
- [x] Manter consentimento nominativo, dados privados, validação de nome/tipo, confirmação humana e revogação. Não reenviar PDFs reais ou aceitar termos pelo usuário durante diagnóstico/testes.
- [x] Confirmar a publicação da correção no Google antes de instruir a usuária a atualizar a página.

## Evidência de diagnóstico

As duas tentativas recentes de upload retornaram HTTP 400 (requisições chegaram ao servidor). A mensagem exata da rejeição não estava disponível no print ou no navegador conectado; não atribuir a causa a nome, arquivo ou seleção sem evidência. Melhorar a visibilidade do erro primeiro. Testar somente com dados sintéticos/banco descartável.

## Motivo esclarecido pela usuária

Em 12/11/2026 às 00:31, a usuária informou que o PDF traz seu sobrenome de casada, enquanto o cadastro utiliza seu sobrenome de solteira. Isso é consistente com a validação atual de correspondência de nomes. Não alterar o cadastro, editar o PDF, importar em nome dela ou afrouxar a validação sem uma instrução específica. A melhoria desta entrega expõe a rejeição claramente e orienta o uso de nomes correspondentes.

## Validação e publicação confirmadas

TypeScript e build aprovados; 390 testes unitários aprovados (2 ignorados já existentes) e 24 cenários integrados em banco PostgreSQL descartável. PR #43 integrado; publicação automática Google concluída com sucesso em 12/11/2026. Revisão prospectafluxus-00011-85v, commit 977c4be3676aff23737087d9f5a915e56f39a8da. Módulo público idêntico ao compilado, flag de importação true preservada, API nega consulta sem login (401). A usuária escolheu manter Michelle Bis; nenhum cadastro, PDF pessoal, leitor ou consentimento foi alterado.
