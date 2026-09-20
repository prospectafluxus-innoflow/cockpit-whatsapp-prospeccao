import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FLUXUS_DIMENSIONS,
  FLUXUS_DIMENSION_META,
  type FluxusDimension,
} from "@shared/fluxus";
import {
  FLUXUS_MOMENT_DIMENSIONS,
  FLUXUS_MOMENT_META,
  FLUXUS_SUSTAINABILITY_INDICATORS,
  FLUXUS_SUSTAINABILITY_META,
  type FluxusMomentDimension,
  type FluxusSustainabilityIndicator,
  type FluxusV2Result,
} from "@shared/fluxusV2";
import { AlertTriangle, CheckCircle2, ShieldAlert, TrendingUp } from "lucide-react";
import { useState } from "react";
import { FluxusPersonaLogo } from "./FluxusBrand";

export type FluxusBeta2ReportProps = {
  result: FluxusV2Result;
  personName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  audience?: "participant" | "manager";
};

type ScorePoint = { label: string; value: number; note?: string };

function toneForSignal(signal: FluxusV2Result["sustentabilidade"]) {
  if (signal === "Sustentável")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (signal === "Ponto de atenção")
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
}

function scoreTone(value: number, risk = false) {
  const favorable = risk ? value <= 3 : value >= 5;
  const attention = risk ? value >= 5 : value <= 3;
  if (favorable) return "bg-emerald-500";
  if (attention) return "bg-red-500";
  return "bg-amber-500";
}

function ScoreBars({ points, riskKeys = [], neutral = false }: { points: ScorePoint[]; riskKeys?: string[]; neutral?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        {neutral ? <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-primary" />Intensidade autorrelatada — sem classificação positiva ou negativa</span> : <><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Faixa favorável</span><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Acompanhar</span><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Ponto de atenção</span></>}
        <span className="ml-auto">Escala: 1 a 7</span>
      </div>
      {points.map(point => {
        const risk = riskKeys.includes(point.label);
        const width = `${Math.max(0, Math.min(100, (point.value / 7) * 100))}%`;
        return (
          <div key={point.label}>
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{point.label}</p>
                {point.note ? <p className="text-xs text-muted-foreground">{point.note}</p> : null}
              </div>
              <strong className="text-sm">{point.value.toFixed(1)}</strong>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${neutral ? "bg-primary" : scoreTone(point.value, risk)}`} style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RadarChart({ result }: { result: FluxusV2Result }) {
  const labels = FLUXUS_DIMENSIONS.map(dimension => FLUXUS_DIMENSION_META[dimension].label);
  const series = [
    { name: "Perfil comportamental", color: "#43a97b", values: FLUXUS_DIMENSIONS.map(dimension => result.dimensions[dimension].natural) },
    { name: "Função percebida", color: "#4f82d1", values: FLUXUS_DIMENSIONS.map(dimension => result.dimensions[dimension].funcaoPercebida) },
  ];
  const cx = 220, cy = 150, radius = 100;
  const axis = (index: number, r = radius) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / labels.length;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };
  const point = (value: number, index: number) => {
    const [x, y] = axis(index, radius * Math.max(0, Math.min(7, value)) / 7);
    return `${x},${y}`;
  };
  return (
    <div>
      <div className="mb-4 grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        {FLUXUS_DIMENSIONS.map((dimension, index) => (
          <div key={dimension} className="bg-card p-3">
            <p className="text-xs font-bold uppercase tracking-wide">{labels[index]}</p>
            <p className="mt-1 text-sm text-muted-foreground">Perfil: <strong className="text-foreground">{series[0].values[index].toFixed(1)}</strong></p>
            <p className="text-sm text-muted-foreground">Função: <strong className="text-foreground">{series[1].values[index].toFixed(1)}</strong></p>
          </div>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
        {series.map(item => <span key={item.name}><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>)}
        <span className="ml-auto">Escala: 1 a 7</span>
      </div>
      <svg viewBox="0 0 440 285" className="h-[300px] w-full" role="img" aria-label="Perfil comportamental comparado à função percebida">
        <rect width="440" height="285" rx="12" fill="#071017" />
        {[1, 2, 3, 4, 5, 6, 7].map(level => <polygon key={level} points={labels.map((_, index) => axis(index, radius * level / 7).join(",")).join(" ")} fill="none" stroke="#64748b" strokeOpacity={level === 7 ? 1 : .55} />)}
        {labels.map((label, index) => { const [x, y] = axis(index); return <g key={label}><line x1={cx} y1={cy} x2={x} y2={y} stroke="#64748b" /><text x={x} y={y + (y < cy ? -10 : 20)} textAnchor="middle" fill="#fff" stroke="#071017" strokeWidth="3" paintOrder="stroke" fontSize="14" fontWeight="700">{label}</text></g>; })}
        {series.map(item => <polygon key={item.name} points={item.values.map(point).join(" ")} fill={item.color} fillOpacity=".28" stroke={item.color} strokeWidth="4" />)}
      </svg>
    </div>
  );
}

function Header({ badge, title, text }: { badge: string; title: string; text: string }) {
  return <section className="rounded-3xl border border-border/60 bg-card p-6"><Badge variant="outline">{badge}</Badge><h2 className="mt-3 text-2xl font-semibold">{title}</h2><p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">{text}</p></section>;
}

function ProfileReport({ result }: { result: FluxusV2Result }) {
  const points = FLUXUS_DIMENSIONS.map(dimension => ({ label: FLUXUS_DIMENSION_META[dimension].label, value: result.dimensions[dimension].natural, note: FLUXUS_DIMENSION_META[dimension].shortLabel }));
  return <div className="space-y-5">
    <Header badge="Bloco 1 · Perfil" title="Perfil comportamental" text="Descreve o modo habitual de atuação segundo o autorrelato da pessoa. O modelo é autoral e inspirado em dimensões comportamentais difundidas pelo DISC; não é um teste DISC oficial." />
    <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Pontuação por dimensão</CardTitle></CardHeader><CardContent><ScoreBars points={points} neutral /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Leitura do perfil</CardTitle></CardHeader><CardContent className="space-y-3">{FLUXUS_DIMENSIONS.map(dimension => { const score = result.dimensions[dimension].natural; const meta = FLUXUS_DIMENSION_META[dimension]; return <div key={dimension} className="rounded-xl border border-border/60 p-4"><div className="flex items-center justify-between gap-3"><strong>{meta.label}</strong><Badge variant="secondary">{score.toFixed(1)} · {result.dimensions[dimension].faixaNatural}</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{score >= 5 ? meta.high : score <= 3 ? meta.low : `Tendência moderada em ${meta.label.toLowerCase()}; sua manifestação pode variar conforme contexto e responsabilidade.`}</p></div>; })}</CardContent></Card></div>
  </div>;
}

function MomentReport({ result }: { result: FluxusV2Result }) {
  const points = FLUXUS_MOMENT_DIMENSIONS.map(dimension => ({ label: FLUXUS_MOMENT_META[dimension].label, value: result.momento[dimension].score, note: FLUXUS_MOMENT_META[dimension].definition }));
  return <div className="space-y-5">
    <Header badge="Bloco 2 · Contexto" title="Momento atual no trabalho" text={`Leitura contextual referente às ${result.referenceWindow}. Separa a experiência atual do perfil comportamental. É um modelo próprio Fluxus, inspirado na distinção entre pessoa e contexto, sem equivalência com PDA.`} />
    <Card><CardHeader><CardTitle className="text-base">Condições percebidas no ciclo</CardTitle></CardHeader><CardContent><ScoreBars points={points} /></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{FLUXUS_MOMENT_DIMENSIONS.map(dimension => { const item = result.momento[dimension]; const meta = FLUXUS_MOMENT_META[dimension]; return <Card key={dimension}><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><strong>{meta.label}</strong><Badge variant={item.signal === "favoravel" ? "secondary" : "default"}>{item.score.toFixed(1)} · {item.signal === "favoravel" ? "Favorável" : item.signal === "acompanhar" ? "Acompanhar" : "Priorizar conversa"}</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{meta.definition}</p></CardContent></Card>; })}</div>
  </div>;
}

function SustainabilityReport({ result }: { result: FluxusV2Result }) {
  const points = FLUXUS_SUSTAINABILITY_INDICATORS.map(indicator => ({ label: FLUXUS_SUSTAINABILITY_META[indicator].label, value: result.indicadores[indicator].score, note: FLUXUS_SUSTAINABILITY_META[indicator].definition }));
  const riskKeys = (["pressao", "desgaste"] as FluxusSustainabilityIndicator[]).map(indicator => FLUXUS_SUSTAINABILITY_META[indicator].label);
  return <div className="space-y-5">
    <Header badge="Bloco 3 · Fluxus" title="Índice Fluxus de sustentabilidade" text="Combina fatores protetivos, pressão percebida, sinais autorrelatados de desgaste e demanda de adaptação. É um sinal exploratório para orientar prevenção e conversa — não diagnostica estresse, burnout ou qualquer condição de saúde." />
    <Card className={toneForSignal(result.sustentabilidade)}><CardContent className="p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide">Sinal atual</p><p className="mt-1 text-2xl font-semibold">{result.sustentabilidade}</p></div><div className="text-right"><p className="text-xs">Índice exploratório</p><p className="text-2xl font-semibold">{result.indiceSustentabilidade.toFixed(1)} / 7</p></div></div><p className="mt-4 text-sm leading-relaxed">{result.sustentabilidade === "Sustentável" ? "As respostas não produziram um alerta relevante neste ciclo. Preserve os fatores protetivos e acompanhe mudanças." : result.sustentabilidade === "Ponto de atenção" ? "Há fatores que merecem acompanhamento e uma conversa sobre contexto, prioridades, recursos e recuperação." : "A combinação de respostas recomenda uma conversa acolhedora e prioritária, revisão das condições de trabalho e, quando apropriado, orientação para apoio profissional."}</p></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Indicadores do Índice Fluxus</CardTitle></CardHeader><CardContent><ScoreBars points={points} riskKeys={riskKeys} /></CardContent></Card>
    <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Fatores protetivos relatados</CardTitle></CardHeader><CardContent>{result.protectiveFactors.length ? <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">{result.protectiveFactors.map(item => <li key={item}>{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhum indicador atingiu a faixa exploratória favorável. Isso não significa ausência de recursos; aprofunde na conversa.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" />Pontos para investigar</CardTitle></CardHeader><CardContent>{result.attentionFactors.length ? <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">{result.attentionFactors.map(item => <li key={item}>{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">Não houve ponto de atenção relevante segundo as regras exploratórias desta versão.</p>}</CardContent></Card></div>
    <Card className="border-blue-500/30 bg-blue-500/5"><CardContent className="flex gap-3 p-5"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" /><p className="text-sm leading-relaxed text-muted-foreground"><strong className="text-foreground">Limite de interpretação:</strong> este resultado não confirma burnout, transtorno, incapacidade ou desempenho. Ele organiza sinais autorrelatados para uma conversa responsável e para revisão do contexto de trabalho.</p></CardContent></Card>
  </div>;
}

function FitReport({ result }: { result: FluxusV2Result }) {
  return <div className="space-y-5">
    <Header badge="Aderência percebida" title="Perfil comportamental × função atual" text="Compara o perfil comportamental autorrelatado com o que a pessoa percebe que a função exige. A distância indica esforço potencial de adaptação, não inadequação ou falta de competência." />
    <Card><CardHeader><CardTitle className="text-base">Mapa de perfil e exigência percebida</CardTitle></CardHeader><CardContent><RadarChart result={result} /></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Demandas por dimensão</CardTitle></CardHeader><CardContent className="space-y-3">{FLUXUS_DIMENSIONS.map(dimension => { const item = result.dimensions[dimension]; const meta = FLUXUS_DIMENSION_META[dimension]; return <div key={dimension} className="grid gap-2 rounded-xl border border-border/60 p-4 sm:grid-cols-[1.2fr_repeat(3,1fr)_auto] sm:items-center"><strong>{meta.label}</strong><Metric label="Perfil" value={item.natural} /><Metric label="Função" value={item.funcaoPercebida} /><Metric label="Diferença" value={item.demanda} /><Badge variant={item.demandaAbsoluta >= 1.5 ? "default" : "secondary"}>{item.demandaAbsoluta >= 1.5 ? item.demanda > 0 ? "Intensificar" : "Modular" : "Próximo"}</Badge></div>; })}</CardContent></Card>
  </div>;
}

function ConsolidatedReport({ result, audience }: { result: FluxusV2Result; audience: "participant" | "manager" }) {
  const principal = FLUXUS_DIMENSION_META[result.predominante].label;
  return <div className="space-y-5">
    <Header badge="Síntese Beta 2" title="Pessoa, momento e sustentabilidade" text={`O perfil predominante relatado é ${principal}. O momento atual e o Índice Fluxus são leituras contextuais das ${result.referenceWindow} e podem mudar entre ciclos.`} />
    <div className="grid gap-4 sm:grid-cols-4"><Summary label="Perfil predominante" value={principal} /><Summary label="Momento geral" value={`${result.momentoGeral.toFixed(1)} / 7`} /><Summary label="Índice Fluxus" value={`${result.indiceSustentabilidade.toFixed(1)} / 7`} /><Summary label="Sinal" value={result.sustentabilidade} /></div>
    <Card><CardHeader><CardTitle className="text-base">Próxima conversa recomendada</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{[
      "O que mais contribuiu para sua energia e seu engajamento nas últimas quatro semanas?",
      "Quais demandas, interrupções ou expectativas mais dificultaram seu trabalho?",
      "Que mudança de contexto teria maior impacto positivo agora?",
      "Qual apoio concreto deveria ser combinado e revisto no próximo ciclo?",
    ].map(question => <div key={question} className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">{question}</div>)}</CardContent></Card>
    {audience === "manager" ? <ManagerDecisionSupport result={result} /> : <Card><CardHeader><CardTitle className="text-base">Seu plano de observação</CardTitle></CardHeader><CardContent className="text-sm leading-relaxed text-muted-foreground">Escolha um fator protetivo para preservar e um ponto de atenção para conversar com seu gestor ou RH. Registre ações observáveis, responsáveis e data de revisão — sem transformar o relatório em rótulo pessoal.</CardContent></Card>}
  </div>;
}

function ManagerDecisionSupport({ result }: { result: FluxusV2Result }) {
  const [careerEvidenceAcknowledged, setCareerEvidenceAcknowledged] =
    useState(false);
  const momentActions: Partial<Record<FluxusMomentDimension, string>> = {
    engajamento: "Investigar sentido, reconhecimento e conexão entre atividades e objetivos; não atribuir a causa à pessoa sem ouvir seu contexto.",
    cargaSustentavel: "Rever volume, prioridades, interrupções, prazos e capacidade disponível. A primeira ação é de desenho do trabalho.",
    autonomia: "Clarificar alçadas e ampliar autonomia gradualmente, com critérios e suporte combinados.",
    clareza: "Alinhar responsabilidades, prioridades e critérios de qualidade em linguagem observável.",
    apoioReconhecimento: "Combinar frequência de feedback, recursos necessários e formas coerentes de reconhecimento.",
    relacoesSeguranca: "Criar condições seguras para pedir ajuda, discordar e sinalizar riscos sem retaliação.",
    desenvolvimento: "Construir um plano de aprendizagem e discutir próximos desafios de forma transparente.",
  };
  const contextualPriorities = FLUXUS_MOMENT_DIMENSIONS.filter(
    dimension => result.momento[dimension].score <= 3.5
  );
  const profilePriorities = FLUXUS_DIMENSIONS.filter(
    dimension => result.dimensions[dimension].demandaAbsoluta >= 1.5
  );
  return <div className="space-y-5">
    <Card className="border-red-500/20"><CardHeader><CardTitle className="text-base">Pontos de atenção para RH/gestor</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-relaxed"><div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-4"><span>Sinal de sustentabilidade do ciclo</span><Badge className={toneForSignal(result.sustentabilidade)}>{result.sustentabilidade}</Badge></div>{result.attentionFactors.length ? <ul className="list-disc space-y-2 pl-5 text-muted-foreground">{result.attentionFactors.map(item => <li key={item}>{item}</li>)}</ul> : <p className="text-muted-foreground">Não houve ponto de atenção relevante pelas regras exploratórias desta versão. Mantenha acompanhamento e preserve os fatores protetivos.</p>}<p className="rounded-xl border border-border/60 p-4 text-muted-foreground"><strong className="text-foreground">Como usar:</strong> trate os itens como hipóteses para confirmar com exemplos, frequência e contexto. Não revele rótulos, não diagnostique e não converta um alerta em avaliação de desempenho.</p></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Plano de desenvolvimento e condições de apoio</CardTitle></CardHeader><CardContent className="space-y-5"><div><h4 className="font-semibold">Prioridades de contexto — responsabilidade compartilhada</h4>{contextualPriorities.length ? <div className="mt-3 space-y-3">{contextualPriorities.map(dimension => <div key={dimension} className="rounded-xl border border-border/60 p-4"><div className="flex items-center justify-between gap-3"><strong>{FLUXUS_MOMENT_META[dimension].label}</strong><Badge variant="secondary">{result.momento[dimension].score.toFixed(1)}</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{momentActions[dimension]}</p></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Nenhuma dimensão do Momento Atual atingiu a faixa de priorização. Preserve as condições mais favoráveis.</p>}</div><div><h4 className="font-semibold">Hipóteses de desenvolvimento comportamental</h4>{profilePriorities.length ? <div className="mt-3 space-y-3">{profilePriorities.map(dimension => { const item = result.dimensions[dimension]; return <div key={dimension} className="rounded-xl border border-border/60 p-4"><div className="flex items-center justify-between gap-3"><strong>{FLUXUS_DIMENSION_META[dimension].label}</strong><Badge variant="secondary">Gap {item.demanda > 0 ? "+" : ""}{item.demanda.toFixed(1)}</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{developmentHypothesis(dimension, item.demanda > 0 ? "intensificar" : "modular")}</p></div>; })}</div> : <p className="mt-2 text-sm text-muted-foreground">A função percebida não apresentou distância relevante do perfil. Desenvolvimento ainda deve se basear nas entregas, aspirações e requisitos reais do cargo.</p>}</div></CardContent></Card>
    <Card className="border-amber-500/30"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" />Discussão responsável sobre promoção</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground"><p>O Fluxus não declara a pessoa apta ou inapta e o Índice Fluxus não deve ser usado como critério de promoção. Esta seção serve apenas para lembrar quais evidências externas precisam ser reunidas.</p><label className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><input type="checkbox" checked={careerEvidenceAcknowledged} onChange={event => setCareerEvidenceAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 print:hidden" /><span><strong className="text-foreground">Reconheço que qualquer discussão de carreira exige devolutiva com o participante e evidências independentes de desempenho, competência, interesse e condições de transição.</strong></span></label>{careerEvidenceAcknowledged ? <><div className="grid gap-3 md:grid-cols-2">{[
      "Resultados sustentados e qualidade das entregas",
      "Competências exigidas no próximo cargo",
      "Autonomia e responsabilidade já demonstradas",
      "Aprendizagem e aplicação de feedback",
      "Interesse real da pessoa pelo próximo desafio",
      "Recursos, sucessão e apoio para a transição",
    ].map(item => <div key={item} className="rounded-xl border border-border/60 p-3"><span className="mr-2">□</span>{item}</div>)}</div><p>Se o sinal atual for <strong className="text-foreground">Conversa prioritária</strong>, primeiro investigue carga, recuperação e apoio. Isso não elimina uma promoção, mas exige entender se ampliar responsabilidades seria desejado e sustentável.</p></> : <p className="rounded-xl bg-muted/40 p-4">Marque a confirmação acima para exibir o checklist. A ausência de confirmação mantém esta orientação bloqueada.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Sequência de devolutiva</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p><strong className="text-foreground">1.</strong> Comece pela voz do colaborador, sem revelar conclusões antecipadas.</p><p><strong className="text-foreground">2.</strong> Confirme exemplos e mudanças ocorridas nas últimas quatro semanas.</p><p><strong className="text-foreground">3.</strong> Diferencie comportamento, condições de trabalho e desempenho observado.</p><p><strong className="text-foreground">4.</strong> Combine até duas ações concretas, responsáveis e data de revisão.</p><p><strong className="text-foreground">5.</strong> Em caso de sofrimento ou risco à saúde, use os canais profissionais apropriados; não faça diagnóstico.</p></CardContent></Card>
  </div>;
}

function developmentHypothesis(
  dimension: FluxusDimension,
  direction: "intensificar" | "modular"
) {
  const copy: Record<
    FluxusDimension,
    Record<"intensificar" | "modular", string>
  > = {
    realizador: {
      intensificar: "Praticar decisão com critérios claros, posicionamento e assunção gradual de responsabilidade. O gestor deve definir alçadas e oferecer feedback sobre impacto.",
      modular: "Praticar pausa, consulta e consideração de riscos antes de decidir. O objetivo é ampliar repertório, não reduzir iniciativa.",
    },
    comunicador: {
      intensificar: "Desenvolver apresentação, influência e construção de relacionamento com objetivos observáveis e preparação adequada.",
      modular: "Praticar escuta, síntese e foco para equilibrar interação com profundidade e execução.",
    },
    planejador: {
      intensificar: "Fortalecer acompanhamento, constância, escuta e previsibilidade de compromissos, com rotinas simples de controle.",
      modular: "Experimentar mudanças em ciclos curtos e aumentar flexibilidade diante de prioridades novas, preservando estabilidade suficiente.",
    },
    analista: {
      intensificar: "Desenvolver critérios, análise de evidências e revisão de qualidade proporcionais ao risco da entrega.",
      modular: "Praticar decisões com informação suficiente e critérios de ‘bom o bastante’, evitando análise além do valor gerado.",
    },
  };
  return copy[dimension][direction];
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border/60 bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value.toFixed(1)}</p></div>; }

export function FluxusBeta2PrintableReport(props: FluxusBeta2ReportProps) {
  const completedDate = new Intl.DateTimeFormat("pt-BR").format(new Date(props.result.completedAt));
  const audience = props.audience ?? "participant";
  return <div className="hidden print:block print:text-black">
    <section className="mb-8 rounded-3xl border border-slate-300 bg-white p-8 text-slate-950"><div className="flex items-center justify-between gap-6"><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">InnoFlow · Fluxus Persona Beta 2</p><FluxusPersonaLogo className="h-auto w-[190px] object-contain" /></div><h1 className="mt-3 text-3xl font-semibold">Relatório de perfil, momento e sustentabilidade</h1><p className="mt-3 text-sm">{props.personName || "Participante"}{props.jobTitle ? ` · ${props.jobTitle}` : ""}{props.companyName ? ` · ${props.companyName}` : ""}</p><div className="mt-5 grid grid-cols-3 gap-3 text-xs"><div><strong>Conclusão</strong><br />{completedDate}</div><div><strong>Instrumento</strong><br />{props.result.instrumentVersion}</div><div><strong>Fórmula</strong><br />{props.result.formulaVersion}</div></div><p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-600">Documento confidencial. O resultado é autorrelatado e exploratório. Não é diagnóstico de saúde, prova de competência nem fundamento isolado para decisões de emprego.</p></section>
    <section className="break-after-page"><ProfileReport result={props.result} /></section>
    <section className="break-after-page"><MomentReport result={props.result} /></section>
    <section className="break-after-page"><SustainabilityReport result={props.result} /></section>
    <section className="break-after-page"><FitReport result={props.result} /></section>
    <ConsolidatedReport result={props.result} audience={audience} />
  </div>;
}

export function FluxusBeta2ReportTabs(props: FluxusBeta2ReportProps) {
  const audience = props.audience ?? "participant";
  return <><div className="print:hidden"><Tabs defaultValue="consolidada" className="space-y-5"><TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5"><TabsTrigger value="perfil">Perfil</TabsTrigger><TabsTrigger value="momento">Momento atual</TabsTrigger><TabsTrigger value="fluxus">Índice Fluxus</TabsTrigger><TabsTrigger value="aderencia">Perfil × Função</TabsTrigger><TabsTrigger value="consolidada">Síntese</TabsTrigger></TabsList><TabsContent value="perfil"><ProfileReport result={props.result} /></TabsContent><TabsContent value="momento"><MomentReport result={props.result} /></TabsContent><TabsContent value="fluxus"><SustainabilityReport result={props.result} /></TabsContent><TabsContent value="aderencia"><FitReport result={props.result} /></TabsContent><TabsContent value="consolidada"><ConsolidatedReport result={props.result} audience={audience} /></TabsContent></Tabs></div><FluxusBeta2PrintableReport {...props} /></>;
}
