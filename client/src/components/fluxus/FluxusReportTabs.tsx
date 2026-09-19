import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FLUXUS_DIMENSIONS,
  FLUXUS_DIMENSION_META,
  type FluxusDimension,
  type FluxusResult,
} from "@shared/fluxus";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FluxusReport } from "./FluxusReport";
import { FluxusManagerGuidance } from "./FluxusManagerGuidance";
import type { ReactElement } from "react";

const chartHeight = "h-[320px]";

function scoreData(result: FluxusResult, key: "comportamental" | "tendencias") {
  return FLUXUS_DIMENSIONS.map(dimension => ({
    dimension: FLUXUS_DIMENSION_META[dimension].label,
    score: result.dimensions[dimension][key],
  }));
}

function comparisonData(result: FluxusResult) {
  return FLUXUS_DIMENSIONS.map(dimension => ({
    dimension: FLUXUS_DIMENSION_META[dimension].label,
    Comportamental: result.dimensions[dimension].comportamental,
    Tendências: result.dimensions[dimension].tendencias,
  }));
}

function profileData(result: FluxusResult) {
  return FLUXUS_DIMENSIONS.map(dimension => ({
    dimension: FLUXUS_DIMENSION_META[dimension].label,
    Natural: result.dimensions[dimension].natural,
    Adaptado: result.dimensions[dimension].funcaoPercebida,
  }));
}

function ChartCard({ title, children }: { title: string; children: ReactElement }) {
  const profileLegend = title === "Perfil Fluxus — Natural × Adaptado";
  return (
    <Card className="border-border/60">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-5 pt-0">
        {profileLegend && <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#43a97b]" />Natural — tendência do perfil</span><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#4f82d1]" />Adaptado — exigência percebida da função</span></div>}
        <div className={`${chartHeight} min-h-[280px] w-full`}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
      </CardContent>
    </Card>
  );
}

function RadarSingle({ data, color, name }: { data: { dimension: string; score: number }[]; color: string; name: string }) {
  return (
    <RadarChart data={data} outerRadius="72%">
      <PolarGrid stroke="hsl(var(--border))" />
      <PolarAngleAxis dataKey="dimension" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
      <Radar name={name} dataKey="score" stroke={color} fill={color} fillOpacity={0.28} />
      <Tooltip /><Legend />
    </RadarChart>
  );
}

function ScoreBar({ data, color, name }: { data: { dimension: string; score: number }[]; color: string; name: string }) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis dataKey="dimension" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
      <YAxis domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} tick={{ fill: "hsl(var(--muted-foreground))" }} />
      <Tooltip /><Legend /><Bar dataKey="score" name={name} fill={color} radius={[5, 5, 0, 0]} />
    </BarChart>
  );
}

function DimensionDescription({ dimension, score }: { dimension: FluxusDimension; score: number }) {
  const meta = FLUXUS_DIMENSION_META[dimension];
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="font-semibold">{meta.label}</p><p className="text-xs text-muted-foreground">{meta.definition}</p></div>
          <Badge variant={score >= 5 ? "default" : "secondary"}>{score.toFixed(1)} · {score >= 5 ? "Alta" : score <= 3 ? "Baixa" : "Moderada"}</Badge>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{score >= 4 ? meta.high : meta.low}</p>
      </CardContent>
    </Card>
  );
}

function InstrumentReport({ result, kind }: { result: FluxusResult; kind: "comportamental" | "tendencias" }) {
  const isBehavioral = kind === "comportamental";
  const data = scoreData(result, kind);
  const label = isBehavioral ? "Comportamental" : "Tendências";
  const predominant = [...FLUXUS_DIMENSIONS].sort((a, b) => result.dimensions[b][kind] - result.dimensions[a][kind])[0];
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-card p-6">
        <Badge variant="outline">Relatório {label}</Badge>
        <h2 className="mt-3 text-2xl font-semibold">Resultado — Análise de {label}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Leitura independente dos quatro eixos Fluxus, conforme a planilha original.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Summary label="Eixo predominante" value={FLUXUS_DIMENSION_META[predominant].label} />
          <Summary label="Maior pontuação" value={result.dimensions[predominant][kind].toFixed(1)} />
          <Summary label="Escala" value="1 a 7" />
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title={`Perfil de ${label} — Radar`}><RadarSingle data={data} color={isBehavioral ? "#43a97b" : "#f6b44c"} name={label} /></ChartCard>
        <ChartCard title="Pontuação por eixo"><ScoreBar data={data} color={isBehavioral ? "#43a97b" : "#f6b44c"} name={label} /></ChartCard>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{FLUXUS_DIMENSIONS.map(dimension => <DimensionDescription key={dimension} dimension={dimension} score={result.dimensions[dimension][kind]} />)}</div>
      <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Laudo descritivo</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{FLUXUS_DIMENSIONS.map(dimension => { const score = result.dimensions[dimension][kind]; const meta = FLUXUS_DIMENSION_META[dimension]; return <div key={dimension} className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed"><strong>{meta.label}:</strong> {score >= 4 ? meta.high : meta.low}</div>; })}</CardContent></Card>
    </div>
  );
}

function ProfileReport({ result }: { result: FluxusResult }) {
  const data = profileData(result);
  const indicators = [
    { label: "Energia", value: result.energia.score, band: result.energia.faixa },
    { label: "Equilíbrio / autorregulação", value: result.autorregulacao.score, band: result.autorregulacao.faixa },
    { label: "Pressão de adaptação", value: result.distanciaMediaAdaptacao, band: result.distanciaMediaAdaptacao >= 1.5 ? "Alta" : result.distanciaMediaAdaptacao <= 0.75 ? "Baixa" : "Moderada" },
    { label: "Maior gap", value: result.maiorGap, band: result.sustentabilidade },
  ];
  return <div className="space-y-5">
    <section className="rounded-3xl border border-border/60 bg-card p-6"><Badge variant="outline">Perfil Fluxus</Badge><h2 className="mt-3 text-2xl font-semibold">Natural × Adaptado</h2><p className="mt-2 text-sm text-muted-foreground">Consolidação do perfil natural com o que a função exige, preservando direção e magnitude da demanda de adaptação.</p></section>
    <div className="grid gap-5 lg:grid-cols-2"><ChartCard title="Perfil Fluxus — Natural × Adaptado"><ResponsiveContainer width="100%" height="100%"><RadarChart data={data} outerRadius="72%"><PolarGrid stroke="hsl(var(--border))" /><PolarAngleAxis dataKey="dimension" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} /><Radar name="Natural" dataKey="Natural" stroke="#43a97b" fill="#43a97b" fillOpacity={0.26} /><Radar name="Adaptado" dataKey="Adaptado" stroke="#4f82d1" fill="#4f82d1" fillOpacity={0.16} /><Tooltip /><Legend /></RadarChart></ResponsiveContainer></ChartCard><ChartCard title="Indicadores Complementares (0–7)"><BarChart data={indicators} margin={{ top: 8, right: 12, left: -18, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis domain={[0, 7]} ticks={[0, 1, 2, 3, 4, 5, 6, 7]} /><Tooltip /><Bar dataKey="value" name="Valor" fill="#4f82d1" radius={[5, 5, 0, 0]} /></BarChart></ChartCard></div>
    <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Dimensões, demanda e sinal de adaptação</CardTitle></CardHeader><CardContent><div className="grid gap-3">{FLUXUS_DIMENSIONS.map(dimension => { const item = result.dimensions[dimension]; const meta = FLUXUS_DIMENSION_META[dimension]; return <div key={dimension} className="grid gap-2 rounded-xl border border-border/60 p-4 sm:grid-cols-[1.3fr_repeat(4,1fr)] sm:items-center"><strong>{meta.label}</strong><Metric label="Natural" value={item.natural} /><Metric label="Adaptado" value={item.funcaoPercebida} /><Metric label="Demanda" value={item.demanda} /><Badge variant={Math.abs(item.demanda) >= 1.5 ? "default" : "secondary"}>{Math.abs(item.demanda) >= 1.5 ? item.demanda > 0 ? "Intensificar" : "Modular" : "Alinhado"}</Badge></div>; })}</div></CardContent></Card>
    <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Indicadores complementares</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{indicators.map(item => <div key={item.label} className="rounded-xl bg-muted/40 p-4"><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-xl font-semibold">{item.value.toFixed(1)} · {item.band}</p></div>)}</CardContent></Card>
  </div>;
}

function ComparisonReport({ result }: { result: FluxusResult }) {
  const data = comparisonData(result);
  const convergent = FLUXUS_DIMENSIONS.filter(d => result.dimensions[d].coerencia === "Convergente").length;
  return <div className="space-y-5"><section className="rounded-3xl border border-border/60 bg-card p-6"><Badge variant="outline">Comparativo</Badge><h2 className="mt-3 text-2xl font-semibold">Comportamental × Tendências</h2><p className="mt-2 text-sm text-muted-foreground">Cruzamento eixo a eixo, destacando convergências e pontos que merecem investigação na devolutiva.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Summary label="Eixos convergentes" value={`${convergent} de 4`} /><Summary label="Predominante comportamental" value={FLUXUS_DIMENSION_META[[...FLUXUS_DIMENSIONS].sort((a,b) => result.dimensions[b].comportamental-result.dimensions[a].comportamental)[0]].label} /><Summary label="Predominante tendências" value={FLUXUS_DIMENSION_META[[...FLUXUS_DIMENSIONS].sort((a,b) => result.dimensions[b].tendencias-result.dimensions[a].tendencias)[0]].label} /></div></section><ChartCard title="Comportamental × Tendências — Dimensões correspondentes"><RadarChart data={data} outerRadius="72%"><PolarGrid stroke="hsl(var(--border))" /><PolarAngleAxis dataKey="dimension" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} /><Radar name="Comportamental" dataKey="Comportamental" stroke="#43a97b" fill="#43a97b" fillOpacity={0.24} /><Radar name="Tendências" dataKey="Tendências" stroke="#f6b44c" fill="#f6b44c" fillOpacity={0.18} /><Tooltip /><Legend /></RadarChart></ChartCard><Card className="border-border/60"><CardHeader><CardTitle className="text-base">Leitura cruzada por dimensão</CardTitle></CardHeader><CardContent className="space-y-3">{FLUXUS_DIMENSIONS.map(dimension => { const item = result.dimensions[dimension]; const meta = FLUXUS_DIMENSION_META[dimension]; const same = item.coerencia === "Convergente"; return <div key={dimension} className="rounded-xl border border-border/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{meta.label}</strong><Badge variant={same ? "secondary" : "default"}>{item.coerencia}</Badge></div><p className="mt-2 text-sm text-muted-foreground">Comportamental {item.comportamental.toFixed(1)} · Tendências {item.tendencias.toFixed(1)} · diferença {item.diferencaInstrumentos.toFixed(1)}.</p><p className="mt-2 text-sm leading-relaxed">{same ? "Convergência entre as duas leituras: traço mais consolidado para confirmar com exemplos reais." : "As leituras diferem neste eixo: explorar contexto, momento e situações em que cada lado aparece."}</p></div>; })}</CardContent></Card><Card className="border-border/60"><CardHeader><CardTitle className="text-base">Síntese final</CardTitle></CardHeader><CardContent className="text-sm leading-relaxed text-muted-foreground">Dos quatro eixos comparados, {convergent} apresentaram convergência. Use os eixos divergentes como perguntas de devolutiva, não como inconsistências ou rótulos definitivos.</CardContent></Card></div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value.toFixed(1)}</p></div>; }

export function FluxusReportTabs(props: { result: FluxusResult; personName?: string | null; companyName?: string | null; jobTitle?: string | null; department?: string | null }) {
  return <Tabs defaultValue="consolidada" className="space-y-5">
    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5 print:hidden">
      <TabsTrigger value="comportamental">Comportamental</TabsTrigger><TabsTrigger value="tendencias">Tendências</TabsTrigger><TabsTrigger value="perfil">Perfil Fluxus</TabsTrigger><TabsTrigger value="comparativo">Comparativo</TabsTrigger><TabsTrigger value="consolidada">Análise Consolidada</TabsTrigger>
    </TabsList>
    <TabsContent value="comportamental"><InstrumentReport result={props.result} kind="comportamental" /></TabsContent>
    <TabsContent value="tendencias"><InstrumentReport result={props.result} kind="tendencias" /></TabsContent>
    <TabsContent value="perfil"><ProfileReport result={props.result} /></TabsContent>
    <TabsContent value="comparativo"><ComparisonReport result={props.result} /></TabsContent>
    <TabsContent value="consolidada"><div className="space-y-6"><FluxusManagerGuidance result={props.result} /><FluxusReport {...props} /></div></TabsContent>
  </Tabs>;
}
