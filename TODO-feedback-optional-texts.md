# Feedback EEC — textos opcionais

Solicitação da usuária em 03/11/2026: retirar a obrigatoriedade de Evidência observável, Efeito verificável e Conselho e apoio para não impedir a conclusão do feedback.

- [x] Permitir concluir e corrigir avaliações com os três textos EEC vazios; campos omitidos na API são normalizados para string vazia.
- [x] Manter nota inteira de 0 a 6 em cada competência para concluir; zero é válido e nota ausente não vira zero.
- [x] Indicar os textos como opcionais no editor e substituir mensagens antigas de obrigatoriedade.
- [x] Preservar competências do snapshot, limites de texto, revisão, escopo, ciclo ativo, motivo da correção e liberação/ciência explícitas; sem alterações nos dados preenchidos.
- [x] Conferir regressões locais: TypeScript aprovado, 262 testes aprovados e 2 testes Gemini ignorados conforme a configuração; build de produção aprovado.
- [ ] Confirmar a publicação automática e o módulo atualizado no endereço Google antes de afirmar disponibilidade em produção.

Foram reproduzidos dez testes falhando antes da alteração e posteriormente aprovados, incluindo texto vazio, textos omitidos, nota zero, nota ausente e indicação visual dos campos opcionais. Os testes de integração com banco real não foram executados; o fixture de rejeição por notas ausentes continua correto e teve apenas o rótulo atualizado.

Diagnósticos: Webdev não possui projeto vinculado nesta tarefa; utilizar a checagem TypeScript e o Vitest do repositório externo existente, sem reinicializar infraestrutura. Nenhuma nota, evidência, avaliação ou permissão real foi alterada para validar essa mudança.
