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
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
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

type ScorePoint = {
  label: string;
  shortLabel?: string;
  code?: string;
  value: number;
  note?: string;
  color?: string;
};

type ChartSeries = {
  name: string;
  color: string;
  values: number[];
};

const PROFILE_COLOR = "#43a97b";
const MOMENT_COLOR = "#f6b44c";
const FUNCTION_COLOR = "#4f82d1";
const FLUXUS_COLOR = "#a76bd8";
const DISC_COLORS: Record<FluxusDimension, string> = {
  realizador: "#dc2626",
  comunicador: "#facc15",
  planejador: "#16a34a",
  analista: "#2563eb",
};
const DISC_CODES: Record<FluxusDimension, string> = {
  realizador: "D",
  comunicador: "I",
  planejador: "S",
  analista: "C",
};

const momentShortLabels: Record<FluxusMomentDimension, string> = {
  engajamento: "Engajamento",
  cargaSustentavel: "Carga",
  autonomia: "Autonomia",
  clareza: "Clareza",
  apoioReconhecimento: "Apoio",
  relacoesSeguranca: "Relações",
  desenvolvimento: "Desenvolv.",
};

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
  if (favorable) return "#22c55e";
  if (attention) return "#ef4444";
  return "#f59e0b";
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">{children}</CardContent>
    </Card>
  );
}

function ChartDataTable({
  labels,
  series,
}: {
  labels: string[];
  series: ChartSeries[];
}) {
  return (
    <div
      className="mb-4 overflow-hidden rounded-xl"
      style={{ border: "1px solid #334155", background: "#0f172a", color: "#f8fafc" }}
    >
      <div
        className="flex flex-wrap gap-4 px-4 py-3"
        style={{ borderBottom: "1px solid #334155" }}
      >
        {series.map(item => (
          <span key={item.name} className="inline-flex items-center gap-2 text-sm font-semibold">
            <i className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
        ))}
        <span className="ml-auto text-xs" style={{ color: "#cbd5e1" }}>
          Escala: 1 a 7
        </span>
      </div>
      <div
        className="grid gap-px"
        style={{
          background: "#334155",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        }}
      >
        {labels.map((label, index) => (
          <div key={`${label}-${index}`} className="p-3" style={{ background: "#0f172a" }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#e2e8f0" }}>
              {label}
            </p>
            {series.map(item => (
              <p key={item.name} className="mt-1 text-sm" style={{ color: "#cbd5e1" }}>
                {item.name}: <strong style={{ color: "#ffffff" }}>{item.values[index].toFixed(1)}</strong>
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SvgRadar({
  labels,
  series,
  ariaLabel,
}: {
  labels: string[];
  series: ChartSeries[];
  ariaLabel: string;
}) {
  const cx = 250;
  const cy = 165;
  const radius = 108;
  const count = labels.length;
  const axis = (index: number, r = radius) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };
  const point = (value: number, index: number) => {
    const [x, y] = axis(index, (radius * Math.max(0, Math.min(7, value))) / 7);
    return `${x},${y}`;
  };

  return (
    <div>
      <ChartDataTable labels={labels} series={series} />
      <svg
        viewBox="0 0 500 330"
        className="h-[330px] w-full"
        style={{ display: "block", colorScheme: "dark" }}
        role="img"
        aria-label={ariaLabel}
      >
        <rect width="500" height="330" rx="12" fill="#071017" />
        {[1, 2, 3, 4, 5, 6, 7].map(level => (
          <polygon
            key={level}
            points={labels
              .map((_, index) => axis(index, (radius * level) / 7).join(","))
              .join(" ")}
            fill="none"
            stroke="#64748b"
            strokeOpacity={level === 7 ? 1 : 0.5}
          />
        ))}
        {labels.map((label, index) => {
          const [x, y] = axis(index, radius + 4);
          return (
            <g key={`${label}-${index}`}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#64748b" strokeOpacity=".85" />
              <text
                x={x}
                y={y + (y < cy ? -9 : 18)}
                textAnchor="middle"
                fill="#ffffff"
                stroke="#071017"
                strokeWidth="3"
                paintOrder="stroke"
                fontSize="12"
                fontWeight="700"
              >
                {label}
              </text>
            </g>
          );
        })}
        {series.map(item => (
          <polygon
            key={item.name}
            points={item.values.map(point).join(" ")}
            fill={item.color}
            fillOpacity=".28"
            stroke={item.color}
            strokeWidth="4"
          />
        ))}
      </svg>
    </div>
  );
}

function SvgBars({
  points,
  name,
  color,
  riskKeys = [],
  neutral = false,
}: {
  points: ScorePoint[];
  name: string;
  color: string;
  riskKeys?: string[];
  neutral?: boolean;
}) {
  const width = 760;
  const chartLeft = 48;
  const chartRight = 24;
  const chartTop = 34;
  const chartBottom = 250;
  const usableWidth = width - chartLeft - chartRight;
  const slot = usableWidth / points.length;
  const barWidth = Math.min(58, slot * 0.58);
  const series = [{ name, color, values: points.map(point => point.value) }];
  const hasIndividualColors = points.some(point => point.color);

  return (
    <div>
      {hasIndividualColors ? (
        <div className="mb-3 flex flex-wrap gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs font-semibold">
          {points.map(point => (
            <span key={point.label} className="inline-flex items-center gap-2">
              <i className="h-3 w-3 rounded-full" style={{ backgroundColor: point.color }} />
              {point.code ? `${point.code} — ` : ""}{point.label}
            </span>
          ))}
        </div>
      ) : null}
      <ChartDataTable labels={points.map(point => point.label)} series={series} />
      <svg
        viewBox={`0 0 ${width} 320`}
        className="h-[320px] w-full"
        style={{ display: "block", colorScheme: "dark" }}
        role="img"
        aria-label={`Gráfico de barras — ${name}`}
      >
        <rect width={width} height="320" rx="12" fill="#071017" />
        {[1, 2, 3, 4, 5, 6, 7].map(tick => {
          const y = chartBottom - (tick / 7) * (chartBottom - chartTop);
          return (
            <g key={tick}>
              <line x1={chartLeft} x2={width - chartRight} y1={y} y2={y} stroke="#64748b" strokeOpacity=".5" />
              <text x={chartLeft - 12} y={y + 4} textAnchor="end" fill="#ffffff" fontSize="12" fontWeight="700">
                {tick}
              </text>
            </g>
          );
        })}
        {points.map((item, index) => {
          const x = chartLeft + index * slot + (slot - barWidth) / 2;
          const height = (Math.max(0, Math.min(7, item.value)) / 7) * (chartBottom - chartTop);
          const risk = riskKeys.includes(item.label);
          const fill = item.color ?? (neutral ? color : scoreTone(item.value, risk));
          return (
            <g key={item.label}>
              <rect x={x} y={chartBottom - height} width={barWidth} height={height} rx="7" fill={fill} />
              <text
                x={x + barWidth / 2}
                y={chartBottom - height - 8}
                textAnchor="middle"
                fill="#ffffff"
                stroke="#071017"
                strokeWidth="3"
                paintOrder="stroke"
                fontSize="15"
                fontWeight="800"
              >
                {item.value.toFixed(1)}
              </text>
              <text
                x={x + barWidth / 2}
                y="278"
                textAnchor="middle"
                fill="#ffffff"
                stroke="#071017"
                strokeWidth="3"
                paintOrder="stroke"
                fontSize="11"
                fontWeight="700"
              >
                {item.shortLabel ?? item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SvgGroupedBars({
  points,
  firstName,
  secondName,
  firstColor,
  secondColor,
}: {
  points: { label: string; first: number; second: number }[];
  firstName: string;
  secondName: string;
  firstColor: string;
  secondColor: string;
}) {
  const width = 660;
  const chartLeft = 48;
  const chartBottom = 242;
  const chartTop = 32;
  const slot = (width - chartLeft - 24) / points.length;
  const barWidth = Math.min(44, slot * 0.28);
  const series: ChartSeries[] = [
    { name: firstName, color: firstColor, values: points.map(point => point.first) },
    { name: secondName, color: secondColor, values: points.map(point => point.second) },
  ];

  return (
    <div>
      <ChartDataTable labels={points.map(point => point.label)} series={series} />
      <svg viewBox={`0 0 ${width} 310`} className="h-[310px] w-full" role="img" aria-label={`${firstName} comparado a ${secondName}`}>
        <rect width={width} height="310" rx="12" fill="#071017" />
        {[1, 2, 3, 4, 5, 6, 7].map(tick => {
          const y = chartBottom - (tick / 7) * (chartBottom - chartTop);
          return <g key={tick}><line x1={chartLeft} x2={width - 24} y1={y} y2={y} stroke="#64748b" strokeOpacity=".5" /><text x={chartLeft - 12} y={y + 4} textAnchor="end" fill="#fff" fontSize="12">{tick}</text></g>;
        })}
        {points.map((item, index) => {
          const center = chartLeft + index * slot + slot / 2;
          const firstHeight = (item.first / 7) * (chartBottom - chartTop);
          const secondHeight = (item.second / 7) * (chartBottom - chartTop);
          return <g key={item.label}>
            <rect x={center - barWidth - 3} y={chartBottom - firstHeight} width={barWidth} height={firstHeight} rx="6" fill={firstColor} />
            <rect x={center + 3} y={chartBottom - secondHeight} width={barWidth} height={secondHeight} rx="6" fill={secondColor} />
            <text x={center - barWidth / 2 - 3} y={chartBottom - firstHeight - 7} textAnchor="middle" fill="#fff" stroke="#071017" strokeWidth="3" paintOrder="stroke" fontSize="13" fontWeight="800">{item.first.toFixed(1)}</text>
            <text x={center + barWidth / 2 + 3} y={chartBottom - secondHeight - 7} textAnchor="middle" fill="#fff" stroke="#071017" strokeWidth="3" paintOrder="stroke" fontSize="13" fontWeight="800">{item.second.toFixed(1)}</text>
            <text x={center} y="274" textAnchor="middle" fill="#fff" stroke="#071017" strokeWidth="3" paintOrder="stroke" fontSize="12" fontWeight="700">{item.label}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}

function Header({ badge, title, text }: { badge: string; title: string; text: string }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6">
      <Badge variant="outline">{badge}</Badge>
      <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">{text}</p>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/60 bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value.toFixed(1)}</p></div>;
}

function ProfileReport({ result }: { result: FluxusV2Result }) {
  const points = FLUXUS_DIMENSIONS.map(dimension => ({
    label: FLUXUS_DIMENSION_META[dimension].label,
    shortLabel: FLUXUS_DIMENSION_META[dimension].shortLabel,
    code: DISC_CODES[dimension],
    value: result.dimensions[dimension].natural,
    note: FLUXUS_DIMENSION_META[dimension].definition,
    color: DISC_COLORS[dimension],
  }));
  const principal = FLUXUS_DIMENSION_META[result.predominante].label;

  return <div className="space-y-5">
    <Header badge="Bloco 1 · Perfil" title="Perfil comportamental" text="Descreve o modo habitual de atuação segundo o autorrelato. O modelo é autoral e inspirado em dimensões comportamentais difundidas pelo DISC; não é um teste DISC oficial." />
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Dimensão predominante" value={principal} /><Summary label="Maior pontuação" value={`${result.dimensions[result.predominante].natural.toFixed(1)} / 7`} /><Summary label="Natureza da leitura" value="Modo habitual" /></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard title="Perfil comportamental — Radar"><SvgRadar labels={points.map(point => point.shortLabel ?? point.label)} series={[{ name: "Perfil comportamental", color: PROFILE_COLOR, values: points.map(point => point.value) }]} ariaLabel="Radar do perfil comportamental" /></ChartCard>
      <ChartCard title="Perfil comportamental — Barras"><SvgBars points={points} name="Perfil comportamental" color={PROFILE_COLOR} neutral /></ChartCard>
    </div>
    <div className="grid gap-4 md:grid-cols-2">{FLUXUS_DIMENSIONS.map(dimension => { const score = result.dimensions[dimension].natural; const meta = FLUXUS_DIMENSION_META[dimension]; return <Card key={dimension}><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><strong>{meta.label}</strong><Badge variant="secondary">{score.toFixed(1)} · {result.dimensions[dimension].faixaNatural}</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{score >= 5 ? meta.high : score <= 3 ? meta.low : `Tendência moderada em ${meta.label.toLowerCase()}; sua manifestação pode variar conforme o contexto e a responsabilidade.`}</p></CardContent></Card>; })}</div>
  </div>;
}

function TendenciesReport({ result }: { result: FluxusV2Result }) {
  const points = FLUXUS_MOMENT_DIMENSIONS.map(dimension => ({
    label: FLUXUS_MOMENT_META[dimension].label,
    shortLabel: momentShortLabels[dimension],
    value: result.momento[dimension].score,
    note: FLUXUS_MOMENT_META[dimension].definition,
  }));
  const strongest = [...FLUXUS_MOMENT_DIMENSIONS].sort((a, b) => result.momento[b].score - result.momento[a].score)[0]!;
  const attention = [...FLUXUS_MOMENT_DIMENSIONS].sort((a, b) => result.momento[a].score - result.momento[b].score)[0]!;

  return <div className="space-y-5">
    <Header badge="Bloco 2 · Tendências atuais" title="Como a pessoa está hoje" text={`Leitura contextual das ${result.referenceWindow}. Mostra condições percebidas que podem favorecer ou limitar a expressão do perfil. É um modelo próprio Fluxus, inspirado na distinção entre pessoa e contexto, sem equivalência com PDA.`} />
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Tendência mais favorável" value={`${FLUXUS_MOMENT_META[strongest].label} · ${result.momento[strongest].score.toFixed(1)}`} /><Summary label="Tendência a acompanhar" value={`${FLUXUS_MOMENT_META[attention].label} · ${result.momento[attention].score.toFixed(1)}`} /><Summary label="Momento geral" value={`${result.momentoGeral.toFixed(1)} / 7`} /></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard title="Tendências atuais — Radar"><SvgRadar labels={points.map(point => point.shortLabel ?? point.label)} series={[{ name: "Tendências atuais", color: MOMENT_COLOR, values: points.map(point => point.value) }]} ariaLabel="Radar das tendências atuais" /></ChartCard>
      <ChartCard title="Tendências atuais — Barras"><SvgBars points={points} name="Tendências atuais" color={MOMENT_COLOR} /></ChartCard>
    </div>
    <div className="grid gap-4 md:grid-cols-2">{FLUXUS_MOMENT_DIMENSIONS.map(dimension => { const item = result.momento[dimension]; const meta = FLUXUS_MOMENT_META[dimension]; return <Card key={dimension}><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><strong>{meta.label}</strong><Badge variant={item.signal === "favoravel" ? "secondary" : "default"}>{item.score.toFixed(1)} · {item.signal === "favoravel" ? "Favorável" : item.signal === "acompanhar" ? "Acompanhar" : "Priorizar conversa"}</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{meta.definition}</p></CardContent></Card>; })}</div>
  </div>;
}

function SustainabilityReport({ result }: { result: FluxusV2Result }) {
  const points = FLUXUS_SUSTAINABILITY_INDICATORS.map(indicator => ({
    label: FLUXUS_SUSTAINABILITY_META[indicator].label,
    shortLabel: FLUXUS_SUSTAINABILITY_META[indicator].label.replace(" disponível", "").replace(" percebida", "").replace("Sinais de ", ""),
    value: result.indicadores[indicator].score,
    note: FLUXUS_SUSTAINABILITY_META[indicator].definition,
  }));
  const riskKeys = (["pressao", "desgaste"] as FluxusSustainabilityIndicator[]).map(indicator => FLUXUS_SUSTAINABILITY_META[indicator].label);

  return <div className="space-y-5">
    <Header badge="Bloco 3 · Fluxus" title="Energia, equilíbrio, pressão e desgaste" text="O Índice Fluxus combina fatores protetivos, pressão percebida, sinais autorrelatados de desgaste e demanda de adaptação. É um sinal exploratório para orientar prevenção e conversa — não diagnostica estresse, burnout ou qualquer condição de saúde." />
    <Card className={toneForSignal(result.sustentabilidade)}><CardContent className="p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide">Sinal atual</p><p className="mt-1 text-2xl font-semibold">{result.sustentabilidade}</p></div><div className="text-right"><p className="text-xs">Índice exploratório</p><p className="text-2xl font-semibold">{result.indiceSustentabilidade.toFixed(1)} / 7</p></div></div><p className="mt-4 text-sm leading-relaxed">{result.sustentabilidade === "Sustentável" ? "As respostas não produziram um alerta relevante neste ciclo. Preserve os fatores protetivos e acompanhe mudanças." : result.sustentabilidade === "Ponto de atenção" ? "Há fatores que merecem acompanhamento e uma conversa sobre contexto, prioridades, recursos e recuperação." : "A combinação de respostas recomenda uma conversa acolhedora e prioritária, revisão das condições de trabalho e, quando apropriado, orientação para apoio profissional."}</p></CardContent></Card>
    <ChartCard title="Indicadores do Índice Fluxus — Barras"><SvgBars points={points} name="Índice Fluxus" color={FLUXUS_COLOR} riskKeys={riskKeys} /></ChartCard>
    <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Fatores protetivos relatados</CardTitle></CardHeader><CardContent>{result.protectiveFactors.length ? <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">{result.protectiveFactors.map(item => <li key={item}>{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhum indicador atingiu a faixa exploratória favorável. Isso não significa ausência de recursos; aprofunde na conversa.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" />Pontos para investigar</CardTitle></CardHeader><CardContent>{result.attentionFactors.length ? <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">{result.attentionFactors.map(item => <li key={item}>{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">Não houve ponto de atenção relevante segundo as regras exploratórias desta versão.</p>}</CardContent></Card></div>
    <Card className="border-blue-500/30 bg-blue-500/5"><CardContent className="flex gap-3 p-5"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" /><p className="text-sm leading-relaxed text-muted-foreground"><strong className="text-foreground">Limite de interpretação:</strong> este resultado não confirma burnout, transtorno, incapacidade ou desempenho. Ele organiza sinais autorrelatados para uma conversa responsável e para revisão do contexto de trabalho.</p></CardContent></Card>
  </div>;
}

function ProfileTendenciesComparisonReport({ result }: { result: FluxusV2Result }) {
  const principal = FLUXUS_DIMENSION_META[result.predominante].label;
  const strongest = [...FLUXUS_MOMENT_DIMENSIONS].sort((a, b) => result.momento[b].score - result.momento[a].score)[0]!;
  const attention = [...FLUXUS_MOMENT_DIMENSIONS].sort((a, b) => result.momento[a].score - result.momento[b].score)[0]!;
  const profileSeries: ChartSeries[] = [{ name: "Perfil comportamental", color: PROFILE_COLOR, values: FLUXUS_DIMENSIONS.map(dimension => result.dimensions[dimension].natural) }];
  const momentSeries: ChartSeries[] = [{ name: "Tendências atuais", color: MOMENT_COLOR, values: FLUXUS_MOMENT_DIMENSIONS.map(dimension => result.momento[dimension].score) }];

  return <div className="space-y-5">
    <Header badge="Comparativo Beta 2" title="Perfil comportamental × Tendências atuais" text="Cruza o modo habitual com a experiência atual. Como os dois blocos medem construtos diferentes, os valores não são sobrepostos eixo a eixo; a leitura compara padrões e hipóteses de contexto sem transformar momento em personalidade." />
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Perfil predominante" value={principal} /><Summary label="Tendência mais favorável" value={FLUXUS_MOMENT_META[strongest].label} /><Summary label="Tendência a acompanhar" value={FLUXUS_MOMENT_META[attention].label} /></div>
    <div className="grid gap-5 xl:grid-cols-2"><ChartCard title="Radar do perfil"><SvgRadar labels={FLUXUS_DIMENSIONS.map(dimension => FLUXUS_DIMENSION_META[dimension].shortLabel)} series={profileSeries} ariaLabel="Radar do perfil no comparativo" /></ChartCard><ChartCard title="Radar das tendências atuais"><SvgRadar labels={FLUXUS_MOMENT_DIMENSIONS.map(dimension => momentShortLabels[dimension])} series={momentSeries} ariaLabel="Radar das tendências atuais no comparativo" /></ChartCard></div>
    <Card><CardHeader><CardTitle className="text-base">Leitura integrada sem equivalência artificial</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{FLUXUS_DIMENSIONS.map(dimension => { const meta = FLUXUS_DIMENSION_META[dimension]; const score = result.dimensions[dimension].natural; return <div key={dimension} className="rounded-xl border border-border/60 p-4"><div className="flex items-center justify-between gap-3"><strong>{meta.label}</strong><Badge variant="secondary">Perfil {score.toFixed(1)}</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">A intensidade em {meta.label.toLowerCase()} compõe o modo habitual. Neste ciclo, <strong className="text-foreground">{FLUXUS_MOMENT_META[attention].label}</strong> é a condição que mais pede conversa. Investigue como esse contexto amplia, limita ou exige adaptação dessa característica.</p></div>; })}</CardContent></Card>
  </div>;
}

function FitReport({ result }: { result: FluxusV2Result }) {
  const points = FLUXUS_DIMENSIONS.map(dimension => ({
    label: FLUXUS_DIMENSION_META[dimension].label,
    first: result.dimensions[dimension].natural,
    second: result.dimensions[dimension].funcaoPercebida,
  }));
  const series: ChartSeries[] = [
    { name: "Perfil comportamental", color: PROFILE_COLOR, values: points.map(point => point.first) },
    { name: "Função percebida", color: FUNCTION_COLOR, values: points.map(point => point.second) },
  ];

  return <div className="space-y-5">
    <Header badge="Aderência percebida" title="Perfil comportamental × função atual" text="Compara o perfil comportamental autorrelatado com o que a pessoa percebe que a função exige. A distância indica esforço potencial de adaptação, não inadequação ou falta de competência." />
    <div className="grid gap-5 xl:grid-cols-2"><ChartCard title="Perfil × Função — Radar"><SvgRadar labels={points.map(point => point.label)} series={series} ariaLabel="Radar do perfil comparado à função percebida" /></ChartCard><ChartCard title="Perfil × Função — Barras"><SvgGroupedBars points={points} firstName="Perfil comportamental" secondName="Função percebida" firstColor={PROFILE_COLOR} secondColor={FUNCTION_COLOR} /></ChartCard></div>
    <Card><CardHeader><CardTitle className="text-base">Demandas por dimensão</CardTitle></CardHeader><CardContent className="space-y-3">{FLUXUS_DIMENSIONS.map(dimension => { const item = result.dimensions[dimension]; const meta = FLUXUS_DIMENSION_META[dimension]; return <div key={dimension} className="grid gap-2 rounded-xl border border-border/60 p-4 sm:grid-cols-[1.2fr_repeat(3,1fr)_auto] sm:items-center"><strong>{meta.label}</strong><Metric label="Perfil" value={item.natural} /><Metric label="Função" value={item.funcaoPercebida} /><Metric label="Diferença" value={item.demanda} /><Badge variant={item.demandaAbsoluta >= 1.5 ? "default" : "secondary"}>{item.demandaAbsoluta >= 1.5 ? item.demanda > 0 ? "Intensificar" : "Modular" : "Próximo"}</Badge></div>; })}</CardContent></Card>
  </div>;
}

function integratedOpinion(result: FluxusV2Result, audience: "participant" | "manager") {
  const principal = FLUXUS_DIMENSION_META[result.predominante].label;
  const strongest = [...FLUXUS_MOMENT_DIMENSIONS].sort((a, b) => result.momento[b].score - result.momento[a].score)[0]!;
  const attention = [...FLUXUS_MOMENT_DIMENSIONS].sort((a, b) => result.momento[a].score - result.momento[b].score)[0]!;
  const adaptation = result.distanciaMediaAdaptacao >= 1.5
    ? "há demanda relevante de adaptação entre o perfil e a função percebida"
    : result.distanciaMediaAdaptacao <= 0.75
      ? "o perfil e a função percebida estão próximos neste ciclo"
      : "há demanda moderada de adaptação entre o perfil e a função percebida";
  const closing = result.sustentabilidade === "Sustentável"
    ? "O conjunto não gera alerta relevante no ciclo. A prioridade é preservar os fatores protetivos e acompanhar mudanças de contexto."
    : result.sustentabilidade === "Ponto de atenção"
      ? "O conjunto recomenda acompanhamento e uma conversa estruturada sobre prioridades, recursos, recuperação e apoio."
      : "O conjunto recomenda uma conversa acolhedora e prioritária, com revisão das condições de trabalho e encaminhamento aos canais profissionais apropriados quando necessário.";
  const audienceLimit = audience === "manager"
    ? "Antes de qualquer decisão de carreira ou desempenho, confronte esta hipótese com evidências observáveis, requisitos reais da função e a voz do colaborador."
    : "Use esta síntese para preparar uma conversa, não para se rotular ou concluir que existe um problema de saúde ou desempenho.";

  return {
    principal,
    strongest: FLUXUS_MOMENT_META[strongest].label,
    attention: FLUXUS_MOMENT_META[attention].label,
    paragraphs: [
      `O perfil apresenta maior intensidade em ${principal}, sem tornar essa dimensão superior às demais.`,
      `No momento atual, ${FLUXUS_MOMENT_META[strongest].label} aparece como condição mais favorável, enquanto ${FLUXUS_MOMENT_META[attention].label} é a tendência que mais merece investigação.`,
      `Na relação com a função, ${adaptation}. O Índice Fluxus classifica o ciclo como “${result.sustentabilidade}”.`,
      `${closing} ${audienceLimit}`,
    ],
  };
}

function ConsolidatedReport({
  result,
  audience,
  printable = false,
}: {
  result: FluxusV2Result;
  audience: "participant" | "manager";
  printable?: boolean;
}) {
  const opinion = integratedOpinion(result, audience);
  return <div className="space-y-5">
    <Header badge="Análise Consolidada Beta 2" title="Perfil, tendências e Índice Fluxus" text="Integra os três blocos sem apagar suas diferenças: perfil habitual, momento atual e sustentabilidade. O parecer é uma hipótese orientadora, não diagnóstico ou decisão automática." />
    <div className="grid gap-4 sm:grid-cols-4"><Summary label="Perfil predominante" value={opinion.principal} /><Summary label="Momento geral" value={`${result.momentoGeral.toFixed(1)} / 7`} /><Summary label="Índice Fluxus" value={`${result.indiceSustentabilidade.toFixed(1)} / 7`} /><Summary label="Sinal do ciclo" value={result.sustentabilidade} /></div>
    <Card className="border-emerald-500/25"><CardHeader><CardTitle className="text-base">Parecer integrado</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">{opinion.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Próxima conversa recomendada</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{[
      "O que mais contribuiu para sua energia e seu engajamento nas últimas quatro semanas?",
      "Quais demandas, interrupções ou expectativas mais dificultaram seu trabalho?",
      "Como o contexto atual favorece ou limita a expressão do seu perfil?",
      "Qual apoio concreto deveria ser combinado e revisto no próximo ciclo?",
    ].map(question => <div key={question} className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">{question}</div>)}</CardContent></Card>
    {audience === "manager" ? <ManagerDecisionSupport result={result} printable={printable} /> : <Card><CardHeader><CardTitle className="text-base">Plano do colaborador</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p>Escolha um fator protetivo para preservar e um ponto de atenção para conversar com seu gestor ou RH.</p><p>Registre no máximo duas ações observáveis, quem pode apoiar e uma data para revisar o combinado.</p><p>Se houver sofrimento ou preocupação com a saúde, procure os canais profissionais apropriados; este relatório não substitui avaliação clínica.</p></CardContent></Card>}
  </div>;
}

function ManagerDecisionSupport({ result, printable = false }: { result: FluxusV2Result; printable?: boolean }) {
  const [careerEvidenceAcknowledged, setCareerEvidenceAcknowledged] = useState(false);
  const checklistVisible = printable || careerEvidenceAcknowledged;
  const momentActions: Partial<Record<FluxusMomentDimension, string>> = {
    engajamento: "Investigar sentido, reconhecimento e conexão entre atividades e objetivos; não atribuir a causa à pessoa sem ouvir seu contexto.",
    cargaSustentavel: "Rever volume, prioridades, interrupções, prazos e capacidade disponível. A primeira ação é de desenho do trabalho.",
    autonomia: "Clarificar alçadas e ampliar autonomia gradualmente, com critérios e suporte combinados.",
    clareza: "Alinhar responsabilidades, prioridades e critérios de qualidade em linguagem observável.",
    apoioReconhecimento: "Combinar frequência de feedback, recursos necessários e formas coerentes de reconhecimento.",
    relacoesSeguranca: "Criar condições seguras para pedir ajuda, discordar e sinalizar riscos sem retaliação.",
    desenvolvimento: "Construir um plano de aprendizagem e discutir próximos desafios de forma transparente.",
  };
  const contextualPriorities = FLUXUS_MOMENT_DIMENSIONS.filter(dimension => result.momento[dimension].score <= 3.5);
  const profilePriorities = FLUXUS_DIMENSIONS.filter(dimension => result.dimensions[dimension].demandaAbsoluta >= 1.5);

  return <div className="space-y-5">
    <Card className="border-red-500/20"><CardHeader><CardTitle className="text-base">Pontos de atenção para RH/gestor</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-relaxed"><div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-4"><span>Sinal de sustentabilidade do ciclo</span><Badge className={toneForSignal(result.sustentabilidade)}>{result.sustentabilidade}</Badge></div>{result.attentionFactors.length ? <ul className="list-disc space-y-2 pl-5 text-muted-foreground">{result.attentionFactors.map(item => <li key={item}>{item}</li>)}</ul> : <p className="text-muted-foreground">Não houve ponto de atenção relevante pelas regras exploratórias desta versão. Mantenha acompanhamento e preserve os fatores protetivos.</p>}<p className="rounded-xl border border-border/60 p-4 text-muted-foreground"><strong className="text-foreground">Como usar:</strong> trate os itens como hipóteses para confirmar com exemplos, frequência e contexto. Não revele rótulos, não diagnostique e não converta um alerta em avaliação de desempenho.</p></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Plano de desenvolvimento e condições de apoio</CardTitle></CardHeader><CardContent className="space-y-5"><div><h4 className="font-semibold">Prioridades de contexto — responsabilidade compartilhada</h4>{contextualPriorities.length ? <div className="mt-3 space-y-3">{contextualPriorities.map(dimension => <div key={dimension} className="rounded-xl border border-border/60 p-4"><div className="flex items-center justify-between gap-3"><strong>{FLUXUS_MOMENT_META[dimension].label}</strong><Badge variant="secondary">{result.momento[dimension].score.toFixed(1)}</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{momentActions[dimension]}</p></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Nenhuma dimensão do Momento Atual atingiu a faixa de priorização. Preserve as condições mais favoráveis.</p>}</div><div><h4 className="font-semibold">Hipóteses de desenvolvimento comportamental</h4>{profilePriorities.length ? <div className="mt-3 space-y-3">{profilePriorities.map(dimension => { const item = result.dimensions[dimension]; return <div key={dimension} className="rounded-xl border border-border/60 p-4"><div className="flex items-center justify-between gap-3"><strong>{FLUXUS_DIMENSION_META[dimension].label}</strong><Badge variant="secondary">Gap {item.demanda > 0 ? "+" : ""}{item.demanda.toFixed(1)}</Badge></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{developmentHypothesis(dimension, item.demanda > 0 ? "intensificar" : "modular")}</p></div>; })}</div> : <p className="mt-2 text-sm text-muted-foreground">A função percebida não apresentou distância relevante do perfil. Desenvolvimento ainda deve se basear nas entregas, aspirações e requisitos reais do cargo.</p>}</div></CardContent></Card>
    <Card className="border-amber-500/30"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" />Discussão responsável sobre promoção</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground"><p>O Fluxus não declara a pessoa apta ou inapta e o Índice Fluxus não deve ser usado como critério de promoção. Esta seção lembra quais evidências externas precisam ser reunidas.</p>{!printable ? <label className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><input type="checkbox" checked={careerEvidenceAcknowledged} onChange={event => setCareerEvidenceAcknowledged(event.target.checked)} className="mt-1 h-4 w-4" /><span><strong className="text-foreground">Reconheço que qualquer discussão de carreira exige devolutiva com o participante e evidências independentes de desempenho, competência, interesse e condições de transição.</strong></span></label> : <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><strong className="text-foreground">Uso obrigatório:</strong> confronte esta leitura com evidências independentes e com a voz do participante.</p>}{checklistVisible ? <><div className="grid gap-3 md:grid-cols-2">{[
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

function developmentHypothesis(dimension: FluxusDimension, direction: "intensificar" | "modular") {
  const copy: Record<FluxusDimension, Record<"intensificar" | "modular", string>> = {
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

export function FluxusBeta2PrintableReport(props: FluxusBeta2ReportProps) {
  const completedDate = new Intl.DateTimeFormat("pt-BR").format(new Date(props.result.completedAt));
  const audience = props.audience ?? "participant";
  const title = audience === "manager"
    ? "Relatório gerencial — RH e gestor"
    : "Relatório do colaborador";

  return <div className="hidden print:block print:text-black">
    <section className="mb-8 rounded-3xl border border-slate-300 bg-white p-8 text-slate-950"><div className="flex items-center justify-between gap-6"><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">InnoFlow · Fluxus Persona Beta 2</p><FluxusPersonaLogo className="h-auto w-[190px] object-contain" /></div><h1 className="mt-3 text-3xl font-semibold">{title}</h1><p className="mt-2 text-lg text-slate-700">Perfil, tendências atuais, Índice Fluxus e análise consolidada</p><p className="mt-3 text-sm">{props.personName || "Participante"}{props.jobTitle ? ` · ${props.jobTitle}` : ""}{props.department ? ` · ${props.department}` : ""}{props.companyName ? ` · ${props.companyName}` : ""}</p><div className="mt-5 grid grid-cols-3 gap-3 text-xs"><div><strong>Conclusão</strong><br />{completedDate}</div><div><strong>Instrumento</strong><br />{props.result.instrumentVersion}</div><div><strong>Fórmula</strong><br />{props.result.formulaVersion}</div></div><p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-600">Documento confidencial. O resultado é autorrelatado e exploratório. Não é diagnóstico de saúde, prova de competência nem fundamento isolado para decisões de emprego.</p></section>
    <section className="break-after-page"><ProfileReport result={props.result} /></section>
    <section className="break-after-page"><TendenciesReport result={props.result} /></section>
    <section className="break-after-page"><ProfileTendenciesComparisonReport result={props.result} /></section>
    <section className="break-after-page"><SustainabilityReport result={props.result} /></section>
    <section className="break-after-page"><FitReport result={props.result} /></section>
    <ConsolidatedReport result={props.result} audience={audience} printable />
  </div>;
}

export function FluxusBeta2ReportTabs(props: FluxusBeta2ReportProps) {
  const audience = props.audience ?? "participant";
  return <>
    <div className="print:hidden">
      <Tabs defaultValue="perfil" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-3 xl:grid-cols-6">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="tendencias">Tendências</TabsTrigger>
          <TabsTrigger value="fluxus">Índice Fluxus</TabsTrigger>
          <TabsTrigger value="perfil-tendencias">Perfil × Tendências</TabsTrigger>
          <TabsTrigger value="aderencia">Perfil × Função</TabsTrigger>
          <TabsTrigger value="consolidada">Consolidado</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil"><ProfileReport result={props.result} /></TabsContent>
        <TabsContent value="tendencias"><TendenciesReport result={props.result} /></TabsContent>
        <TabsContent value="fluxus"><SustainabilityReport result={props.result} /></TabsContent>
        <TabsContent value="perfil-tendencias"><ProfileTendenciesComparisonReport result={props.result} /></TabsContent>
        <TabsContent value="aderencia"><FitReport result={props.result} /></TabsContent>
        <TabsContent value="consolidada"><ConsolidatedReport result={props.result} audience={audience} /></TabsContent>
      </Tabs>
    </div>
    <FluxusBeta2PrintableReport {...props} />
  </>;
}
