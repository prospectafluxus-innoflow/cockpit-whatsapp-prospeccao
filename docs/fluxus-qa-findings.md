# Fluxus Persona — achados de QA local

**Data:** 17/09/2026  
**Ambiente:** PostgreSQL local isolado, aplicação em `http://localhost:3000`, sem uso de dados de produção.

## Fluxos validados

1. O botão **Fluxus Persona** aparece na tela pública de login do ProspectaFluxus.
2. O item **Fluxus Persona** aparece no menu administrativo existente.
3. O administrador cria uma empresa com código de acesso; o banco armazena um hash bcrypt de 60 caracteres e não o código em texto puro.
4. O colaborador se cadastra com nome, e-mail, empresa, código, cargo, área, senha e aceite de finalidade.
5. A conta do colaborador é vinculada ao `companyId` correto e recebe apenas o tipo de conta `fluxus`.
6. O colaborador entra na área exclusiva, visualiza empresa e progresso, responde quatro etapas e pode salvar rascunho.
7. A conclusão exige todas as 56 respostas e gera o resultado versionado `1.0.0-beta.1`.
8. O relatório individual mostra, separadamente, leitura comportamental, tendências, natural consolidado, função percebida, demanda, energia e autorregulação.
9. A tentativa de abrir `/fluxus/admin` como colaborador redireciona para `/fluxus`; as APIs administrativas também usam `adminProcedure`.
10. O administrador vê totais por empresa, andamento, conclusão e relatórios individuais.
11. A visão consolidada permanece bloqueada enquanto houver menos de três avaliações concluídas, reduzindo identificação indireta.
12. O relatório administrativo inclui a ação **Imprimir / salvar PDF**; a navegação foi ocultada para o modo de impressão.

## Inspeção visual

As telas de login, cadastro, dashboard do colaborador, questionário, relatório, dashboard administrativo e página da empresa foram renderizadas corretamente em viewport de desktop. A hierarquia, os estados, o contraste e a identidade visual permaneceram consistentes com o projeto atual. O questionário utiliza escala de 1 a 7 com ponto intermediário explícito, navegação por etapas e progresso geral.

## Dados de teste confirmados

- Empresa fictícia: `Empresa Piloto`.
- Um colaborador fictício vinculado pelo identificador interno da empresa.
- Avaliação persistida como `completed` com 56 respostas.
- Resultado persistido com versão do instrumento e da fórmula.
- Código da empresa protegido por bcrypt.

## Pendências de produção

A migração `drizzle/0009_fluxus_persona_beta.sql` deve ser aplicada no banco de homologação antes do deploy. O envio de e-mail para redefinição de senha precisa de provedor configurado; em produção o token não é devolvido ao navegador. A Beta 1.0 deve passar por piloto controlado e análise psicométrica antes de alegações de validade preditiva ou uso em decisões de pessoas.

## Inspeção visual final

O relatório foi verificado tanto na área do colaborador quanto no acesso administrativo. Os dois gráficos, os quatro cartões de síntese, as quatro dimensões detalhadas e os avisos de interpretação foram renderizados sem sobreposição. O dashboard administrativo apresentou uma empresa, um colaborador, 100% de conclusão e consolidado protegido por grupo mínimo. A navegação lateral permaneceu consistente com o ProspectaFluxus, e o botão público Fluxus Persona ficou visível no topo da tela de login.

A inspeção final também confirmou que o menu administrativo, a tabela de empresas, a página detalhada da empresa e o relatório administrativo permanecem legíveis no layout existente. O bloqueio do consolidado aparece com mensagem clara e o botão de relatório só é habilitado para avaliações concluídas.

Os registros visuais finais confirmaram o fluxo completo em sequência: login público com botão Fluxus, cockpit com novo item de menu, dashboard Fluxus com métricas, empresa com proteção de consolidado e relatório administrativo sem perda da identidade visual existente.

## Migrações

O histórico Drizzle completo foi aplicado com sucesso em um PostgreSQL descartável do zero. As migrações `0009_heavy_pyro` e `0010_brainy_violations` criaram as tabelas, colunas, índices e três chaves estrangeiras esperadas. A aplicação de produção pode seguir o comando já documentado `pnpm db:migrate` após backup e homologação.

## Registro visual antes da otimização

As capturas finais mostraram o questionário, o relatório do colaborador, o botão público, o cockpit, o dashboard Fluxus, a empresa e o relatório administrativo sem regressões visuais. A otimização seguinte será limitada ao carregamento sob demanda das páginas, sem alteração de layout ou comportamento.

## Validação final

Após o carregamento sob demanda, `pnpm check` concluiu sem erros, 61 testes passaram, 2 testes opcionais permaneceram ignorados e o build de produção foi gerado. As sete páginas Fluxus e o relatório foram separados em chunks próprios; o fluxo existente permaneceu inalterado.

As capturas preservadas continuaram mostrando corretamente todas as telas validadas; a correção final de dependências não envolve componentes visuais nem contratos Fluxus.

## Resultado definitivo

A instalação final reduziu a auditoria de produção para vulnerabilidades apenas baixas e moderadas, sem alertas altos. A checagem TypeScript passou, 61 testes passaram, 2 testes opcionais ficaram ignorados e o build de produção concluiu. O uso direto de `nanoid` foi removido em favor de primitivas criptográficas nativas do Node, e as versões transitivas corrigidas ficaram registradas em `pnpm-workspace.yaml`.

A revisão das capturas finais confirmou novamente que login, questionário, relatórios e painéis administrativos permaneceram íntegros. A limpeza do diff a seguir modifica apenas organização de código antigo, sem alterar essas telas.
