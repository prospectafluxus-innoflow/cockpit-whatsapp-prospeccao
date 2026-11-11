# Visão executiva Persona — 11/11/2026

- [x] Nova visualização da PRIMEIRA fase, adicional ao relatório atual, inspirada no modelo da Vertical: ficha individual e relatório da equipe, montados com avaliações concluídas Beta 2 sem criar ou importar apresentações.
- [x] Retrato da equipe, distribuição dos sinais, mapa dos quatro perfis, perfil × função percebida, momento atual, prioridades e caminhos de desenvolvimento com linguagem simples e cálculos existentes. Recortes válidos por departamento sem médias de grupos pequenos ou complementos identificáveis.
- [x] Seleção de colaboradores autorizados; dados de clientes, gestores e versões revalidados no servidor. No máximo uma avaliação por pessoa. Dados autorrelatados e hipóteses, nunca aptidão, diagnóstico ou desempenho.
- [x] Síntese, contexto e recomendações consultivas opcionais dentro da plataforma, salvos em relatório separado dos resultados com revisão otimista. Sem copiar contexto da Vertical para outros clientes nem alterar questionários concluídos.
- [x] Exportação individual/equipe PDF com marca Persona, papel claro, gráficos legíveis, indicadores/metadados e ressalvas, sem navegação/editor/controles. Alertar ou bloquear a perda de edições não salvas.
- [x] Acesso pelo relatório individual, equipe e administração da empresa. Publicação na aplicação Google existente após validação, sem migração destrutiva ou mudanças em permissões reais para teste.

PPTX editável e o próximo complemento da usuária ficam fora deste escopo. Diagnóstico LSP consultado: nenhum projeto Webdev vinculado; usar pnpm check e Vitest existentes.

## Evidências de validação — 11/11/2026

TypeScript e build de produção aprovados. Suíte completa: 319 testes aprovados e dois testes Gemini previamente ignorados. Regressões incluem isolamento entre clientes, escopo vazio de gestor, revogação de acesso, seleção imutável, conflito de revisão, campos consultivos opcionais, salvamento inicial sem notas, prévia obsoleta e bloqueio de edição durante a gravação.

Migração 0014 validada em PostgreSQL descartável e aplicada de forma aditiva; estrutura confirmada no Supabase com RLS ativa, sem políticas públicas. Nenhuma avaliação, papel ou permissão de pessoa real foi alterada para validar.

PDF A4 horizontal conferido com dados fictícios: três páginas no individual (capa e ficha em duas páginas), trinta no recorte sintético de dez pessoas e cinco com notas longas. Gráficos e última pessoa presentes; marcador final das notas confirmado. As fichas e notas não são cortadas para forçar uma única página.

## Publicação confirmada — 11/11/2026, 18:34 BRT

PR #40 integrado no commit `b80f53411801edb1cfc03614012db549e6647993`; execução GitHub Actions `43102963532` concluída com sucesso. Google Cloud Run serve a revisão `prospectafluxus-00007-hxs`, com label correspondente ao commit. Rota `/fluxus/executiva` responde HTTP 200; endpoint executivo sem login nega acesso com HTTP 401. Assets `FluxusExecutivePage-BAKi78oV.js` e `index-u1mQdODr.css` comparados por SHA-256 com o build local validado, ambos idênticos. A validação pública foi somente de leitura, sem criar relatórios, avaliações ou concessões em produção.
