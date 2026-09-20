# Fluxus Persona Beta 1.0

## Método, interpretação e plano de calibração

**Autor:** Manus AI  
**Versão do instrumento:** `1.0.0-beta.1`  
**Versão da fórmula:** `1.0.0-beta.1`

## Conclusão executiva

A Fluxus Persona Beta 1.0 é uma ferramenta autoral de **reflexão comportamental e desenvolvimento**. Ela não deve ser apresentada como DISC, PDA ou teste psicológico validado. O método utiliza temas comportamentais que se aproximam desses modelos, mas preserva uma arquitetura própria, itens próprios e fórmulas transparentes.

A versão atual corrige três riscos da planilha original. Primeiro, separa duas fontes da leitura natural em vez de duplicar o mesmo resultado. Segundo, substitui a neutralidade artificial por uma escala de sete pontos com centro explícito. Terceiro, mantém a **direção** e a **magnitude** da demanda de adaptação, em vez de somar diferenças e esconder compensações.

> A Beta 1.0 está pronta para um piloto controlado e para devolutivas de desenvolvimento. Ela ainda não está pronta para alegações de validade preditiva, comparação normativa ou decisão isolada sobre contratação, promoção ou desligamento.

## 1. O que a ferramenta mede

A Fluxus Persona organiza as respostas em quatro dimensões autorais.

| Dimensão        | Pergunta central                                            | Conteúdo aproximado                                                  |
| --------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| **Realizador**  | Como a pessoa tende a agir diante de decisões e obstáculos? | Iniciativa, firmeza, autonomia, enfrentamento e velocidade decisória |
| **Comunicador** | Como a pessoa tende a se expressar e mobilizar relações?    | Interação, expressão, influência, conexão e energia social           |
| **Planejador**  | Como a pessoa tende a lidar com ritmo e continuidade?       | Constância, paciência, previsibilidade, cooperação e acompanhamento  |
| **Analista**    | Como a pessoa tende a usar critérios e padrões?             | Evidências, detalhes, método, qualidade, estrutura e rastreabilidade |

Essas dimensões lembram temas presentes em instrumentos DISC e PDA. Isso não cria equivalência psicométrica. Diferentes instrumentos usam itens, formatos de resposta, algoritmos, normas e interpretações próprias. Uma ponte conceitual pode orientar perguntas, mas não autoriza converter escores entre sistemas.[1] [2]

## 2. Estrutura do questionário

O questionário possui **56 afirmações** divididas em quatro etapas. Todas utilizam escala de 1 a 7. O valor 4 representa uma posição intermediária real.

| Etapa                    | Itens | Finalidade                                                                        |
| ------------------------ | ----: | --------------------------------------------------------------------------------- |
| Comportamental           |    20 | Registrar manifestações observáveis que aparecem com frequência no trabalho atual |
| Tendências               |    20 | Registrar preferências habituais antes da adaptação às expectativas do ambiente   |
| Função percebida         |     8 | Estimar quanto a pessoa entende que sua função atual exige cada dimensão          |
| Energia e autorregulação |     8 | Registrar o momento percebido nas últimas semanas, sem finalidade clínica         |

Cada dimensão possui cinco itens comportamentais, cinco itens de tendências e dois itens de função. Energia e autorregulação possuem quatro itens cada.

A separação entre **comportamental** e **tendências** é deliberada. Os dois blocos podem convergir ou divergir. Uma divergência pode refletir contexto, interpretação dos itens, mudança recente ou resposta pouco estável. Ela deve gerar uma pergunta de devolutiva, não uma correção automática.

## 3. Fórmulas

Para cada dimensão `d`, a ferramenta calcula:

```text
Comportamental(d) = média dos 5 itens comportamentais da dimensão
Tendências(d)      = média dos 5 itens de tendências da dimensão
Natural(d)         = média de Comportamental(d) e Tendências(d)
Função(d)          = média dos 2 itens de função percebida da dimensão
Demanda(d)         = Função(d) - Natural(d)
Magnitude(d)       = |Demanda(d)|
Divergência(d)     = |Comportamental(d) - Tendências(d)|
```

A demanda preserva o sinal. Um valor positivo indica que a função percebida pede **intensificação** daquela dimensão. Um valor negativo indica que a função percebida pede **contenção ou modulação**. Nenhum dos dois sentidos é automaticamente bom ou ruim.

A distância média de adaptação é:

```text
Distância média = média das quatro magnitudes
```

A fórmula evita o problema da soma algébrica. Se uma dimensão exige aumento e outra exige redução, os efeitos não se anulam.

## 4. Faixas e coerência

As faixas atuais são **exploratórias**. Elas não são percentis e não resultam de uma amostra normativa.

| Escore médio | Faixa    |
| -----------: | -------- |
|  1,00 a 3,00 | Baixa    |
|  3,01 a 4,99 | Moderada |
|  5,00 a 7,00 | Alta     |

A coerência entre os dois blocos naturais utiliza a diferença absoluta.

|     Diferença | Leitura     |
| ------------: | ----------- |
|      Até 0,75 | Convergente |
|   0,76 a 1,50 | Parcial     |
| Acima de 1,50 | Investigar  |

Esses limites servem para organizar a devolutiva da Beta 1.0. Eles devem ser revistos após o piloto.

## 5. Energia, autorregulação e sustentabilidade

Energia e autorregulação são **autorrelatos contextuais**. Eles não medem saúde, transtorno, capacidade intelectual, produtividade ou motivação. A documentação do PDA também diferencia nível de energia de interpretações mais amplas, o que reforça a necessidade de linguagem restrita.[2]

O sinal de sustentabilidade combina distância de adaptação e autorregulação percebida.

| Condição exploratória                                                                                       | Sinal               |
| ----------------------------------------------------------------------------------------------------------- | ------------------- |
| Distância abaixo de 1,5 e autorregulação acima de 3                                                         | Favorável           |
| Distância igual ou superior a 1,5, maior gap igual ou superior a 2, ou autorregulação igual ou inferior a 3 | Acompanhar          |
| Distância igual ou superior a 1,5 e autorregulação igual ou inferior a 3                                    | Atenção prioritária |

O sinal não identifica estresse, burnout ou adoecimento. Ele indica apenas quando a devolutiva deve investigar custo, apoio, clareza de papel e sustentabilidade da adaptação.

## 6. Relatório e devolutiva

O relatório apresenta as duas leituras naturais separadamente. O natural consolidado aparece como resumo secundário. A exigência percebida da função é mostrada ao lado do natural, com direção e magnitude do gap.

Uma devolutiva adequada precisa testar o resultado contra exemplos reais. Perguntas úteis incluem: “Em que situação isso aparece?”, “Quando não aparece?”, “Qual parte da função exige adaptação?”, “O esforço é sustentável?” e “Que apoio reduziria o custo?”. O uso competente de avaliações exige finalidade clara, interpretação responsável, confidencialidade e comunicação de limites.[3]

O resultado não prova competência. Uma pontuação alta em Realizador não prova liderança. Uma pontuação alta em Analista não prova qualidade técnica. Evidência de competência deve vir de comportamentos observáveis, entregas e outros métodos relevantes para o trabalho.

## 7. Regras de uso

A Beta 1.0 pode apoiar autoconhecimento, feedback, desenvolvimento de liderança, acordos de equipe e planejamento de comportamentos. Ela não deve ser usada como diagnóstico clínico, medida completa de personalidade ou ranking de valor pessoal.

Em seleção ou promoção, o perfil não pode ser o único critério. Princípios profissionais exigem relação com a análise do trabalho, evidências para a interpretação proposta, critérios definidos e avaliação de equidade e consequências.[4]

O sistema aplica algumas salvaguardas. O participante aceita a finalidade no cadastro. O relatório inclui aviso de limite. A área administrativa exige perfil de administrador. O consolidado de empresa aparece somente após três avaliações concluídas, para reduzir identificação indireta.

## 8. Plano de calibração

A calibração deve ocorrer em etapas. O objetivo inicial não é “provar” o instrumento, mas descobrir quais itens funcionam, quais conceitos se misturam e como os participantes interpretam as perguntas.

### 8.1 Revisão de conteúdo

Especialistas em comportamento organizacional e gestores que conheçam os cargos devem avaliar cada item. Eles precisam verificar clareza, correspondência com a dimensão, ausência de duas ideias na mesma frase, neutralidade de linguagem e aplicabilidade a diferentes funções.

O item deve ser reescrito quando exigir contexto ausente, usar linguagem moral, misturar duas dimensões ou pressupor que um comportamento é sempre desejável.

### 8.2 Entrevistas cognitivas

Um grupo pequeno e diverso deve responder enquanto explica como interpretou cada afirmação. O objetivo é identificar termos ambíguos e diferenças entre o significado pretendido e o significado percebido.

### 8.3 Piloto controlado

O piloto deve reunir participantes de áreas, níveis e empresas diferentes. A meta de amostra precisa ser definida conforme as análises planejadas. Para a primeira rodada, o foco deve ser qualidade dos dados e diversidade, não uma alegação normativa prematura.

O banco já grava versão do instrumento, versão da fórmula, respostas individuais e resultado. Isso permite comparar versões sem sobrescrever o histórico.

### 8.4 Análises mínimas

A análise do piloto deve incluir distribuição de respostas por item, valores ausentes, concentração excessiva no centro ou nos extremos, correlação item-total, consistência interna por dimensão e estabilidade quando houver reaplicação.

Também deve examinar estrutura interna. Se itens de Realizador carregarem sistematicamente em Comunicador, por exemplo, o conteúdo ou a estrutura precisa ser revisto. Uma boa consistência interna, isoladamente, não demonstra validade para decisões de pessoas.

### 8.5 Evidência aplicada

A etapa seguinte deve comparar os escores com comportamentos externos definidos antes da análise. Exemplos incluem cumprimento de rotinas, qualidade do registro de decisões ou frequência de apresentação a clientes. As medidas precisam ser relevantes ao cargo e obtidas de forma ética.

Qualquer uso decisório deve avaliar equidade entre grupos, riscos de impacto adverso, valor incremental e taxa de erro. A validade pertence à interpretação e ao uso, não ao nome do instrumento.[4]

## 9. Critérios de passagem de versão

A versão Beta 1.0 não deve mudar silenciosamente. Alterações em itens geram nova versão do instrumento. Alterações em limites ou fórmulas geram nova versão da fórmula.

Uma versão pode avançar quando os itens críticos forem revisados, a coleta estiver estável, as dimensões apresentarem interpretação coerente e o relatório mantiver linguagem compatível com as evidências. A passagem para um uso mais sensível exige evidência adicional e revisão especializada independente.

## 10. Contrato de cálculo da Beta 1.0

Todas as respostas válidas são números inteiros de 1 a 7. Respostas desconhecidas, fora da escala ou não inteiras são descartadas durante a sanitização. O resultado só é calculado quando os 56 itens válidos estão presentes. Não há imputação de valores ausentes.

As médias e diferenças são arredondadas para duas casas decimais com a regra padrão do JavaScript, `Math.round(valor × 100) ÷ 100`. Cada item possui o mesmo peso dentro do seu bloco. Os blocos Comportamental e Tendências também possuem peso igual no cálculo do Natural.

Quando duas dimensões empatam no maior resultado, a Beta 1.0 usa a primeira dimensão na ordem técnica **Realizador, Comunicador, Planejador e Analista**. Essa escolha serve apenas para manter o cálculo determinístico. O relatório deve informar o empate quando ele for relevante, em vez de sugerir superioridade real da primeira dimensão.

O campo `maiorDemanda` representa a dimensão com a **maior magnitude absoluta** da diferença entre Função percebida e Natural. Ele não significa necessariamente a maior demanda positiva. O sinal da diferença continua necessário para distinguir intensificação de modulação.

O sinal de sustentabilidade utiliza distância média de adaptação, maior gap e autorregulação. Energia é exibida como indicador contextual, mas **não participa da regra de sustentabilidade** da Beta 1.0.

## 11. Matriz de interpretação responsável

| Resultado observado | Hipótese que pode ser formulada | Conclusão que não pode ser formulada |
| --- | --- | --- |
| Natural alto em uma dimensão | A pessoa relata maior disponibilidade relativa daquela tendência | A pessoa possui competência comprovada, potencial superior ou melhor desempenho |
| Natural baixo em uma dimensão | A pessoa relata menor preferência relativa por aquela tendência | A pessoa possui deficiência, incapacidade ou inadequação para a função |
| Demanda positiva | A pessoa percebe que a função pede intensificação daquela dimensão | A função objetivamente exige esse comportamento ou a pessoa está despreparada |
| Demanda negativa | A pessoa percebe necessidade de modular ou conter a dimensão | O comportamento natural é excessivo, ruim ou deve ser eliminado |
| Divergência Comportamental × Tendências | Contexto, momento ou interpretação dos itens merecem investigação | Há inconsistência, mentira ou instabilidade psicológica |
| Autorregulação baixa | Cabe conversar sobre clareza sob pressão, apoio e recuperação percebida | Existe transtorno, adoecimento, burnout ou risco clínico |
| Mudança entre ciclos | O autorrelato ou o contexto mudou entre as datas | Houve melhora, piora ou efeito causal de uma intervenção |
| Média agregada da equipe | O grupo respondente apresenta uma tendência descritiva naquele ciclo | A cultura da empresa foi diagnosticada ou pessoas específicas podem ser inferidas |

## 12. Governança da interpretação

O relatório do participante deve usar linguagem de autodesenvolvimento. Orientações dirigidas ao gestor ficam em uma audiência separada. Métricas agregadas só podem ser liberadas pelo servidor quando o grupo atingir o limiar de privacidade configurado, nunca apenas por ocultação visual.

Toda leitura individual por um administrador deve gerar registro de auditoria. A devolutiva deve registrar exemplos observáveis, hipóteses confirmadas ou descartadas, voz do participante, ações acordadas, apoio do gestor e data de acompanhamento. O registro deve evitar dados clínicos, íntimos ou opiniões sem evidência.

Alterações de itens geram nova versão do instrumento. Alterações de pesos, fórmulas ou limites geram nova versão da fórmula. Resultados concluídos permanecem como snapshots do ciclo e não são recalculados silenciosamente. Comparações entre versões diferentes podem mostrar valores, mas não devem classificar evolução automaticamente.

## Referências

[1]: https://www.discprofile.com/what-is-disc/research-reliability-and-validity "Science behind DiSC — reliability, validity, and model description"
[2]: https://www.pdainternational.net/wp-content/uploads/2024/01/PDA-Technical-Manual-EN-1.pdf "PDA Technical Manual"
[3]: https://www.intestcom.org/page/15 "International Test Commission Guidelines on Test Use"
[4]: https://www.apa.org/ed/accreditation/personnel-selection-procedures.pdf "Principles for the Validation and Use of Personnel Selection Procedures — Fifth Edition"
