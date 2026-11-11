# Avaliações complementares — importação pelo colaborador

- [x] Após concluir Persona, oferecer etapa opcional e acesso posterior, sem bloquear conclusão, histórico ou Feedback; um ou ambos os PDFs podem ser enviados, nunca valores zero por ausência.
- [x] Consentimento específico versionado, caixa laranja não pré-marcada, finalidade e leitores nominativos claros; titular escolhe leitores explicitamente, inclusive se gestor/admin; upload não é concessão genérica de acesso. O servidor compara o termo exibido com os destinatários atuais e rejeita consentimento desatualizado.
- [x] Upload somente do próprio titular autenticado, PDF até 5 MiB, validação do arquivo/modelo/nome/data/escalas, extração local limitada sem transmissão à IA; onde o gráfico não fornece texto, preenchimento assistido e confirmação humana sem pontuações inventadas.
- [x] PDFs cifrados em cofre PostgreSQL protegido por RLS, sem URLs públicas; metadados/pendentes só do titular, compartilhamento só após confirmação; destinatários e vínculos revalidados em toda leitura/download. Leitura e download serializados com retirada; integridade verificada também antes de confirmar.
- [x] QP 0–100, nove Sabotadores 0–10 com decimais, Crítico 1–15 separados; registrar data e contexto. Cada PDF exige apenas sua própria escala. Não alterar análises Persona ou notas EEC nem gerar diagnóstico/ranking.
- [x] Histórico com revisões/limites por pessoa; excluir/revogar remove PDF e resultados no sistema ativo e impede novas leituras, com auditoria mínima sem conteúdo; proprietário mantém retirada acessível mesmo se integração desligada, inclusive de pendentes.
- [x] Formulário acessível, erros/processamento/salvamento e painel dos relatórios próprios/recebidos implementados. Limite HTTP específico de 8 MiB e oito requisições concorrentes; no máximo dois extratores locais simultâneos. Não reduzir o limite de mídias das rotinas anteriores.
- [x] Validar em testes isolados e PostgreSQL descartável, sem testar uploads, consentimentos ou exclusões em dados reais: 363 testes aprovados, dois testes previamente ignorados, TypeScript e build de produção aprovados; vinte cenários integrados locais aprovados.
- [x] Migração 0015 aplicada via Supabase MCP ao projeto existente. Índices compostos da 0011 conferidos no catálogo antes da aplicação. RLS confirmada e tabela vazia; nenhum PDF real importado.
- [ ] Publicar implementação com `FLUXUS_COMPLEMENTARY_ENABLED` desativada por padrão; não habilitar para clientes sem confirmação dos direitos de uso e revisão final do consentimento/privacidade. Aguardar confirmação do deploy Google.
- [ ] Integrar os resultados confirmados e autorizados à visão gerencial visual, no estilo do modelo Vertical, com orientações consultivas de comunicação, apoio e acompanhamento. Essa integração é a continuação solicitada em 11/11/2026 às 19h42 e ainda não foi implementada nesta entrega. Preservar a distinção de datas/escalas, não gerar pontuação combinada ou diagnóstico e não incluir dados sem consentimento nominativo vigente.

## Estado de publicação

Implementação e testes concluídos na branch `feat/persona-complementary-import`; publicação pendente. A importação real permanece desligada até o cumprimento das condições registradas. O relatório executivo atual continua funcionando sem estes dados.
