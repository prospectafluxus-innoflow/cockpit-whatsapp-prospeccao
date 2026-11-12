# Correção da validação de PDFs maiores — 12/11/2026

## Resultado solicitado

- [ ] Aceitar PDFs de resultado próprios até o limite já anunciado de 5 MiB, sem erro interno por tamanho dentro do limite. Não aumentar o teto ou afrouxar validação de nome, Base64 canônico, estrutura PDF, consentimento, criptografia ou leitores.
- [ ] Preservar a mensagem visível já publicada e permitir a conferência depois de um upload aceito.
- [ ] Confirmar a publicação no mesmo serviço Google antes de pedir nova tentativa.

## Causa reproduzida

A expressão regular com repetição de grupos de quatro caracteres em `decodeCanonicalPdf` lança `RangeError: Maximum call stack size exceeded` em Base64 de PDFs sintéticos de 4 e 5 MiB. Arquivos menores passam; os testes anteriores cobriam apenas PDFs pequenos. Logs HTTP de produção mostram duas rejeições 500 com corpo de aproximadamente 5,25 MB, compatíveis com esse cenário. Não é a validação de sobrenome. Permissões e schema de banco conferidos só em leitura e válidos.

## Desenho

Trocar a regex de agrupamento por checagem linear de comprimento e alfabeto; o round-trip Buffer → Base64 já existente garante a forma canônica e rejeita padding inválido ou caracteres inseridos. Incluir regressões em tamanho máximo e fluxo integrado com PDF grande válido em PostgreSQL descartável. Sem migração, sem alteração de cadastro ou PDF real, sem novas dependências.
