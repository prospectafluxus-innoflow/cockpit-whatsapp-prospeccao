# Correção da validação de PDFs maiores — 12/11/2026

## Resultado solicitado

- [x] Aceitar PDFs de resultado próprios até o limite já anunciado de 5 MiB, sem erro interno por tamanho dentro do limite. Não aumentar o teto ou afrouxar validação de nome, Base64 canônico, estrutura PDF, consentimento, criptografia ou leitores.
- [x] Preservar a mensagem visível já publicada e permitir a conferência depois de um upload aceito.
- [x] Confirmar a publicação no mesmo serviço Google antes de pedir nova tentativa.

## Causa reproduzida

A expressão regular com repetição de grupos de quatro caracteres em `decodeCanonicalPdf` lança `RangeError: Maximum call stack size exceeded` em Base64 de PDFs sintéticos de 4 e 5 MiB. Arquivos menores passam; os testes anteriores cobriam apenas PDFs pequenos. Logs HTTP de produção mostram duas rejeições 500 com corpo de aproximadamente 5,25 MB, compatíveis com esse cenário. Não é a validação de sobrenome. Permissões e schema de banco conferidos só em leitura e válidos.

## Desenho

Trocar a regex de agrupamento por checagem linear de comprimento e alfabeto; o round-trip Buffer → Base64 já existente garante a forma canônica e rejeita padding inválido ou caracteres inseridos. Incluir regressões em tamanho máximo e fluxo integrado com PDF grande válido em PostgreSQL descartável. Sem migração, sem alteração de cadastro ou PDF real, sem novas dependências.

## Validação e publicação

Regressões confirmaram a falha anterior e passaram com o validador linear. TypeScript e build aprovados; 393 testes unitários aprovados (2 ignorados já existentes) e 25 cenários integrados aprovados em PostgreSQL descartável, com os dois tipos de PDF grandes próximos do teto de 5 MiB, preservando cifra e revogação. Revisão independente confirmou equivalência da canonicalidade em enumeração e 100 mil entradas aleatórias.

PR #44 integrado; Google CI concluído com sucesso. Produção confirmada em 12/11/2026, revisão prospectafluxus-00012-snl, commit 32a44885df211e297f6b1ffbae0b86d39047e96e; flag de importação true preservada e consulta sem login retorna 401. Nenhum cadastro, leitor, consentimento ou PDF real foi modificado/importado para testar. Nova tentativa da usuária ainda não observada.
