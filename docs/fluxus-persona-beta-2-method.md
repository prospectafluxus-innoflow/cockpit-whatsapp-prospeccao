# Fluxus Persona Beta 2 — especificação metodológica

**Instrumento:** 2.0.0-beta.2  
**Fórmula:** 2.0.0-beta.2  
**Status:** instrumento autoral exploratório em validação

## 1. Objetivo e limites

O Fluxus Persona Beta 2 separa três perguntas que a versão anterior combinava: **como a pessoa tende a atuar**, **como ela está vivenciando o trabalho nas últimas quatro semanas** e **quão sustentável parece a relação atual entre pessoa, contexto e função**.

A ferramenta apoia autoconhecimento, devolutiva e prevenção organizacional. Não é teste psicológico, diagnóstico clínico, avaliação médica, prova de desempenho ou mecanismo automático de decisão de emprego. O uso dos termos “inspirado em DISC” e “inspirado na distinção perfil–contexto observada em modelos como PDA” descreve referências conceituais; não significa equivalência, licenciamento ou conversão de escores.

## 2. Arquitetura do instrumento

| Leitura | Conteúdo | Itens | Janela de referência |
|---|---|---:|---|
| Perfil comportamental | Realizador, Comunicador, Planejador e Analista | 20 | Modo habitual de atuação |
| Momento atual | Engajamento, carga, autonomia, clareza, apoio, relações e desenvolvimento | 21 | Últimas quatro semanas |
| Exigência percebida da função | Dois comportamentos exigidos por dimensão de perfil | 8 | Função atual |
| Índice Fluxus | Energia, recuperação, autorregulação, pressão e desgaste | 12 | Últimas quatro semanas |

A escala de resposta vai de 1 (**discordo totalmente**) a 7 (**concordo totalmente**), exceto o bloco de função, em que 1 significa **quase nunca exige** e 7 significa **exige o tempo todo**.

## 3. Perfil comportamental

Cada dimensão é a média simples dos cinco itens correspondentes:

```text
Perfil(d) = média dos cinco itens comportamentais da dimensão d
```

O perfil natural da Beta 2 é igual ao escore comportamental. O bloco Momento Atual não entra nesse cálculo, eliminando a duplicidade da Beta 1.

As faixas exploratórias são: Baixa, de 1,00 a 3,00; Moderada, de 3,01 a 4,99; e Alta, de 5,00 a 7,00. Essas faixas não são percentis e não representam comparação com uma população normativa.

## 4. Momento atual

O Momento Atual contém sete dimensões de três itens. Um item de carga é redigido em sentido negativo e tem pontuação invertida antes da média. Pontuações maiores representam uma condição percebida mais favorável.

| Dimensão | Interpretação |
|---|---|
| Engajamento e sentido | Interesse, significado e disposição para contribuir |
| Carga sustentável | Volume, prioridades e interrupções administráveis |
| Autonomia e controle | Espaço para organizar e decidir sobre a execução |
| Clareza de papel | Expectativas, prioridades e critérios compreendidos |
| Apoio e reconhecimento | Recursos, orientação, feedback e valorização |
| Relações e segurança para falar | Cooperação e liberdade para pedir ajuda ou discordar |
| Perspectiva e desenvolvimento | Aprendizagem, uso de capacidades e próximos desafios |

A sinalização por dimensão é: **Favorável**, com escore igual ou superior a 4,5; **Acompanhar**, entre 3,01 e 4,49; e **Priorizar conversa**, com escore igual ou inferior a 3,00.

## 5. Exigência percebida e demanda de adaptação

Para cada dimensão de perfil:

```text
Função percebida(d) = média dos dois itens de exigência da dimensão d
Demanda(d) = Função percebida(d) − Perfil(d)
Magnitude(d) = |Demanda(d)|
Distância média = média das quatro magnitudes
```

Demanda positiva sugere que a função parece exigir intensificação. Demanda negativa sugere modulação. A magnitude indica distância percebida, não inadequação, incapacidade ou sofrimento.

## 6. Índice Fluxus de sustentabilidade

Os indicadores protetivos são Energia, Recuperação e Autorregulação. Os indicadores de risco são Pressão percebida e Sinais de desgaste. Para a consolidação, riscos são invertidos matematicamente, de modo que escores maiores no índice final representem condição mais favorável.

```text
Fatores protetivos = média(Energia, Recuperação, Autorregulação)
Riscos invertidos = 8 − média(Pressão, Desgaste)
Ajuste de demanda = máximo(1, 7 − Distância média)
Índice Fluxus = média(Momento geral, Fatores protetivos, Riscos invertidos, Ajuste de demanda)
```

As regras de sinalização são deliberadamente sensíveis a combinações que merecem conversa. **Conversa prioritária** é acionada por desgaste muito alto ou por combinações como pressão alta com recuperação baixa. **Ponto de atenção** indica presença de pressão, baixa energia ou recuperação, condição contextual baixa, distância média de adaptação igual ou superior a 1,5, ou ao menos uma dimensão com magnitude de demanda igual ou superior a 1,5. Na ausência dessas regras, a saída é **Sustentável**.

Essas faixas são heurísticas de triagem para devolutiva e prevenção. Não estimam probabilidade clínica e não confirmam burnout. Conforme a OMS, burnout é um fenômeno ocupacional associado a estresse crônico de trabalho não administrado, caracterizado por exaustão, distanciamento/cinismo e redução da eficácia profissional; não é classificado como condição médica.[1]

## 7. Promoção e desenvolvimento

O Fluxus não emite “apto” ou “inapto”. Uma discussão de promoção deve combinar o relatório com evidências independentes sobre resultados sustentados, requisitos do próximo cargo, competências demonstradas, autonomia, aprendizagem, interesse da pessoa, recursos e apoio à transição.

Um sinal de atenção não elimina a possibilidade de promoção. Ele indica que a organização deve entender se ampliar responsabilidades é desejado e sustentável. Da mesma forma, um sinal sustentável não prova prontidão.

## 8. Compatibilidade com a Beta 1

Avaliações Beta 1 continuam armazenadas com seus itens, fórmulas e relatórios originais. Rascunhos Beta 1 podem ser concluídos pela lógica Beta 1. Novos ciclos são criados como Beta 2. Comparações diretas de evolução só são calculadas quando instrumento e fórmula coincidem.

Ao iniciar a Beta 2 depois de um ciclo concluído, o sistema reaproveita as 20 respostas comportamentais e as 8 respostas de exigência percebida da função, mantendo-as editáveis para revisão. As 21 respostas de Momento Atual e as 12 respostas do Índice Fluxus permanecem vazias, porque medem outro construto e exigem a janela atual de quatro semanas. A origem do preenchimento é registrada na avaliação.

## 9. Relatórios por audiência

O relatório do colaborador enfatiza autoconhecimento, fatores protetivos, pontos para conversar e um plano pessoal de observação. O relatório de RH/gestor acrescenta pontos de atenção priorizados, condições de contexto sob responsabilidade da organização, hipóteses de desenvolvimento comportamental, roteiro de devolutiva e um checklist de evidências externas para conversar sobre carreira. O segundo relatório permanece bloqueado por padrão e só é liberado conforme o papel, a política de visibilidade, a finalidade declarada e a aprovação organizacional explícita para dados contextuais da Beta 2.

As hipóteses de desenvolvimento não devem ser confundidas com déficit pessoal. Quando uma dimensão contextual está baixa, o relatório atribui explicitamente responsabilidade compartilhada e prioriza revisão de carga, clareza, recursos, autonomia, apoio ou relações de trabalho.

## 10. Validação recomendada

Antes de uso decisório, a Beta 2 deve passar por revisão de conteúdo com especialistas, entrevistas cognitivas com participantes, piloto controlado, análise de distribuição e ausência de piso/teto, consistência interna por dimensão, estrutura fatorial, estabilidade temporal do perfil, sensibilidade temporal do Momento Atual, relação com medidas externas apropriadas e análise de impacto adverso. Alterações decorrentes dessa validação exigem nova versão.

## Referências

[1]: World Health Organization. “Burn-out an occupational phenomenon.” https://www.who.int/news/item/28-05-2019-burn-out-an-occupational-phenomenon-international-classification-of-diseases

[2]: Health and Safety Executive. “What are the Management Standards?” https://www.hse.gov.uk/stress/standards/overview.htm

[3]: International Labour Organization. “Psychosocial risks and stress at work.” https://www.ilo.org/resource/psychosocial-risks-and-stress-work
