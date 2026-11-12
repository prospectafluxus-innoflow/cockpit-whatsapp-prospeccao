# Leitura gerencial de Persona + QP/Sabotadores

- [x] Incluir no relatório gerencial visual do modelo Vertical os resultados complementares confirmados e autorizados da mesma avaliação Persona selecionada. QP e Sabotadores podem aparecer separadamente; ausência não é zero nem exige participação. Preservar o relatório padrão sem complemento disponível.
- [x] Gestor/RH/consultoria só veem complemento quando também possuem acesso ao relatório comportamental e foram escolhidos nominalmente pelo titular. Revalidar conta/empresa/consentimento/estado em cada leitura/exportação; nenhum bypass de administrador para fontes de outras pessoas. O titular conserva a leitura de seus próprios relatórios quando tem acesso comportamental correspondente. Revogados, pendentes e fontes de outro colaborador/empresa/ciclo não aparecem; nenhum resultado privado no diretório. O termo v2 explicita a finalidade gerencial; termos antigos não são ampliados retroativamente.
- [x] Mostrar os resultados com escalas e datas próprias, visual claro e orientações consultivas de comunicação, apoio, perguntas e acompanhamento do desenvolvimento dentro da jornada. Não somar instrumentos, gerar diagnóstico, ranking, causalidade ou decisão de carreira; não alterar notas EEC ou metodologia Persona e não enviar dados a IA externa. As nove opções de apoio seguem o catálogo fixo, sem seleção ou prioridade automática por pontuação.
- [x] Reconstruir fontes e recomendações a cada leitura do relatório salvo; não persistir uma cópia dos resultados ou recomendações do livro nas notas executivas. O botão Imprimir/Salvar PDF busca a versão atual e falha fechado se acesso/seleção/revisão não puderem ser revalidados. Ctrl+P direto omite os complementos. Informar o limite das cópias já exportadas.
- [x] Preservar a impressão horizontal do documento, marca e controles existentes; omitir os formulários e imprimir integralmente as fontes e orientações. Validar com fixtures explicitamente fictícios, sem consentir, importar ou alterar dados reais.
- [ ] Publicar pelo deploy Google existente após checks e revisão. Manter novos envios desligados enquanto os direitos de uso e a governança/termo aguardam validação.

## Validação local em 11/11/2026

TypeScript e build de produção aprovados. Suíte completa: 388 testes aprovados, 2 já desativados/skipped. PostgreSQL local descartável: 23 cenários integrados aprovados, incluindo isolamento de ciclo/empresa, ausência de bypass administrativo, termo antigo, retirada e leitura concorrente. Nenhum acesso de teste ao banco de produção ou importação dos PDFs reais enviados pela usuária.

Revisão independente identificou uma priorização automática por nota; removida. A impressão sintética confirmou a preservação dos textos e a omissão dos complementos pelo Ctrl+P direto. O layout usa colunas de impressão explícitas para não herdar o empilhamento móvel e mantém o Crítico junto dos resultados.

Publicação ainda aguardando confirmação da revisão e dos assets servidos pelo Google.
