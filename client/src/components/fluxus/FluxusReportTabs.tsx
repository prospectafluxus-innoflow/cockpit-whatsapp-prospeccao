import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FLUXUS_DIMENSIONS,
  FLUXUS_DIMENSION_META,
  type FluxusDimension,
  type FluxusResult,
} from "@shared/fluxus";

import { FluxusReport } from "./FluxusReport";
import { FluxusManagerGuidance } from "./FluxusManagerGuidance";
import { FluxusPersonaLogo } from "./FluxusBrand";


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
    "Função percebida": result.dimensions[dimension].funcaoPercebida,
  }));
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="border-border/60"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="p-5 pt-0">{children}</CardContent></Card>;
}

function ChartDataTable({ labels, series }: { labels: string[]; series: { name: string; values: number[]; color: string }[] }) {
  return <div className="mb-4 overflow-hidden rounded-xl" style={{ border: "1px solid #334155", background: "#0f172a", color: "#f8fafc" }}>
    <div className="flex flex-wrap gap-4 px-4 py-3" style={{ borderBottom: "1px solid #334155" }}>
      {series.map(item => <span key={item.name} className="inline-flex items-center gap-2 text-sm font-semibold"><i className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>)}
      <span className="ml-auto text-xs" style={{ color: "#cbd5e1" }}>Escala: 1 a 7</span>
    </div>
    <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: "#334155" }}>
      {labels.map((label, index) => <div key={label} className="p-3" style={{ background: "#0f172a" }}><p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#e2e8f0" }}>{label}</p>{series.map(item => <p key={item.name} className="mt-1 text-sm" style={{ color: "#cbd5e1" }}>{item.name}: <strong style={{ color: "#ffffff" }}>{Number(item.values[index]).toFixed(1)}</strong></p>)}</div>)}
    </div>
  </div>;
}

function SvgRadar({ series, labels }: { series: { name: string; values: number[]; color: string }[]; labels: string[] }) {
  const cx = 220, cy = 150, radius = 100, count = labels.length;
  const point = (value: number, index: number) => { const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count; const r = radius * Math.max(0, Math.min(7, Number(value) || 0)) / 7; return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]; };
  const axis = (index: number, r = radius) => { const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count; return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]; };
  return <div>
    <ChartDataTable labels={labels} series={series} />
    <svg viewBox="0 0 440 285" className="h-[300px] w-full" style={{ display: "block", colorScheme: "dark" }} role="img" aria-label="Gráfico radar">
      <rect x="0" y="0" width="440" height="285" rx="12" fill="#071017" />
      <g>
        {[1, 2, 3, 4, 5, 6, 7].map(level => <polygon key={level} points={labels.map((_, i) => axis(i, radius * level / 7).join(",")).join(" ")} fill="none" stroke="#64748b" strokeOpacity={level === 7 ? 1 : 0.55} />)}
        {labels.map((label, i) => { const [x, y] = axis(i); return <g key={label}><line x1={cx} y1={cy} x2={x} y2={y} stroke="#64748b" strokeOpacity=".85" /><text x={x} y={y + (y < cy ? -10 : 20)} textAnchor="middle" fill="#ffffff" stroke="#071017" strokeWidth="3" paintOrder="stroke" fontSize="14" fontWeight="700">{label}</text></g>; })}
        {series.map(item => <polygon key={item.name} points={item.values.map((value, i) => point(value, i).join(",")).join(" ")} fill={item.color} fillOpacity=".32" stroke={item.color} strokeWidth="4" />)}
      </g>
    </svg>
  </div>;
}

function ScoreBar({ data, color, name }: { data: { dimension: string; score: number }[]; color: string; name: string }) {
  const max = 7, chartTop = 28, chartBottom = 235, barWidth = 48, gap = 35;
  const labels = data.map(item => item.dimension);
  const series = [{ name, values: data.map(item => item.score), color }];
  return <div>
    <ChartDataTable labels={labels} series={series} />
    <svg viewBox="0 0 440 285" className="h-[300px] w-full" style={{ display: "block", colorScheme: "dark" }} role="img" aria-label={`Pontuação ${name}`}>
      <rect x="0" y="0" width="440" height="285" rx="12" fill="#071017" />
      <g>
        {[1, 2, 3, 4, 5, 6, 7].map(tick => { const y = chartBottom - (tick / max) * (chartBottom - chartTop); return <g key={tick}><line x1="42" x2="420" y1={y} y2={y} stroke="#64748b" strokeOpacity=".7" /><text x="32" y={y + 4} textAnchor="end" fill="#ffffff" fontSize="12" fontWeight="600">{tick}</text></g>; })}
        {data.map((item, i) => { const x = 57 + i * (barWidth + gap); const score = Number(item.score) || 0; const height = Math.max(0, score / max) * (chartBottom - chartTop); return <g key={item.dimension}><rect x={x} y={chartBottom - height} width={barWidth} height={height} rx="6" fill={color} /><text x={x + barWidth / 2} y={chartBottom - height - 8} textAnchor="middle" fill="#ffffff" stroke="#071017" strokeWidth="3" paintOrder="stroke" fontSize="15" fontWeight="800">{score.toFixed(1)}</text><text x={x + barWidth / 2} y="260" textAnchor="middle" fill="#ffffff" stroke="#071017" strokeWidth="3" paintOrder="stroke" fontSize="13" fontWeight="700">{item.dimension}</text></g>; })}
      </g>
    </svg>
  </div>;
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
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{score >= 5 ? meta.high : score <= 3 ? meta.low : `Pontuação moderada em ${meta.label.toLowerCase()}; confirme em quais contextos a tendência aumenta ou diminui.`}</p>
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
        <ChartCard title={`Perfil de ${label} — Radar`}><SvgRadar labels={data.map(item => item.dimension)} series={[{ name: label, values: data.map(item => item.score), color: isBehavioral ? "#43a97b" : "#f6b44c" }]} /></ChartCard>
        <ChartCard title="Pontuação por eixo"><ScoreBar data={data} color={isBehavioral ? "#43a97b" : "#f6b44c"} name={label} /></ChartCard>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{FLUXUS_DIMENSIONS.map(dimension => <DimensionDescription key={dimension} dimension={dimension} score={result.dimensions[dimension][kind]} />)}</div>
      <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Síntese descritiva</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{FLUXUS_DIMENSIONS.map(dimension => { const score = result.dimensions[dimension][kind]; const meta = FLUXUS_DIMENSION_META[dimension]; return <div key={dimension} className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed"><strong>{meta.label}:</strong> {score >= 5 ? meta.high : score <= 3 ? meta.low : `Faixa moderada; investigue situações em que ${meta.label.toLowerCase()} aparece com maior ou menor intensidade.`}</div>; })}</CardContent></Card>
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
    <section className="rounded-3xl border border-border/60 bg-card p-6"><Badge variant="outline">Perfil Fluxus</Badge><h2 className="mt-3 text-2xl font-semibold">Natural × Função percebida</h2><p className="mt-2 text-sm text-muted-foreground">Consolidação do perfil natural com o que a pessoa percebe que a função exige, preservando direção e magnitude da demanda de adaptação.</p></section>
    <div className="grid gap-5 lg:grid-cols-2"><ChartCard title="Perfil Fluxus — Natural × Função percebida"><div className="mb-2 text-xs text-muted-foreground">Natural — tendência do perfil · Função percebida — exigência relatada da função</div><SvgRadar labels={data.map(item => item.dimension)} series={[{ name: "Natural", values: data.map(item => item.Natural), color: "#43a97b" }, { name: "Função percebida", values: data.map(item => item["Função percebida"]), color: "#4f82d1" }]} /></ChartCard><ChartCard title="Indicadores Complementares (0–7)"><ScoreBar data={indicators.map(item => ({ dimension: item.label, score: item.value }))} color="#4f82d1" name="Valor" /></ChartCard></div>
    <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Dimensões, demanda e sinal de adaptação</CardTitle></CardHeader><CardContent><div className="grid gap-3">{FLUXUS_DIMENSIONS.map(dimension => { const item = result.dimensions[dimension]; const meta = FLUXUS_DIMENSION_META[dimension]; return <div key={dimension} className="grid gap-2 rounded-xl border border-border/60 p-4 sm:grid-cols-[1.3fr_repeat(4,1fr)] sm:items-center"><strong>{meta.label}</strong><Metric label="Natural" value={item.natural} /><Metric label="Função percebida" value={item.funcaoPercebida} /><Metric label="Demanda" value={item.demanda} /><Badge variant={Math.abs(item.demanda) >= 1.5 ? "default" : "secondary"}>{Math.abs(item.demanda) >= 1.5 ? item.demanda > 0 ? "Intensificar" : "Modular" : "Alinhado"}</Badge></div>; })}</div></CardContent></Card>
    <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Indicadores complementares</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{indicators.map(item => <div key={item.label} className="rounded-xl bg-muted/40 p-4"><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-xl font-semibold">{item.value.toFixed(1)} · {item.band}</p></div>)}</CardContent></Card>
  </div>;
}

function ComparisonReport({ result }: { result: FluxusResult }) {
  const data = comparisonData(result);
  const convergent = FLUXUS_DIMENSIONS.filter(d => result.dimensions[d].coerencia === "Convergente").length;
  return <div className="space-y-5"><section className="rounded-3xl border border-border/60 bg-card p-6"><Badge variant="outline">Comparativo</Badge><h2 className="mt-3 text-2xl font-semibold">Comportamental × Tendências</h2><p className="mt-2 text-sm text-muted-foreground">Cruzamento eixo a eixo, destacando convergências e pontos que merecem investigação na devolutiva.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Summary label="Eixos convergentes" value={`${convergent} de 4`} /><Summary label="Predominante comportamental" value={FLUXUS_DIMENSION_META[[...FLUXUS_DIMENSIONS].sort((a,b) => result.dimensions[b].comportamental-result.dimensions[a].comportamental)[0]].label} /><Summary label="Predominante tendências" value={FLUXUS_DIMENSION_META[[...FLUXUS_DIMENSIONS].sort((a,b) => result.dimensions[b].tendencias-result.dimensions[a].tendencias)[0]].label} /></div></section><ChartCard title="Comportamental × Tendências — Dimensões correspondentes"><SvgRadar labels={data.map(item => item.dimension)} series={[{ name: "Comportamental", values: data.map(item => item.Comportamental), color: "#43a97b" }, { name: "Tendências", values: data.map(item => item.Tendências), color: "#f6b44c" }]} /></ChartCard><Card className="border-border/60"><CardHeader><CardTitle className="text-base">Leitura cruzada por dimensão</CardTitle></CardHeader><CardContent className="space-y-3">{FLUXUS_DIMENSIONS.map(dimension => { const item = result.dimensions[dimension]; const meta = FLUXUS_DIMENSION_META[dimension]; const same = item.coerencia === "Convergente"; return <div key={dimension} className="rounded-xl border border-border/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{meta.label}</strong><Badge variant={same ? "secondary" : "default"}>{item.coerencia}</Badge></div><p className="mt-2 text-sm text-muted-foreground">Comportamental {item.comportamental.toFixed(1)} · Tendências {item.tendencias.toFixed(1)} · diferença {item.diferencaInstrumentos.toFixed(1)}.</p><p className="mt-2 text-sm leading-relaxed">{same ? "Convergência entre as duas leituras: traço mais consolidado para confirmar com exemplos reais." : "As leituras diferem neste eixo: explorar contexto, momento e situações em que cada lado aparece."}</p></div>; })}</CardContent></Card><Card className="border-border/60"><CardHeader><CardTitle className="text-base">Síntese final</CardTitle></CardHeader><CardContent className="text-sm leading-relaxed text-muted-foreground">Dos quatro eixos comparados, {convergent} apresentaram convergência. Use os eixos divergentes como perguntas de devolutiva, não como inconsistências ou rótulos definitivos.</CardContent></Card></div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value.toFixed(1)}</p></div>; }

type FluxusReportProps = { result: FluxusResult; personName?: string | null; companyName?: string | null; jobTitle?: string | null; department?: string | null; audience?: "participant" | "manager" };

export function FluxusPrintableReport(props: FluxusReportProps) {
  const completedDate = new Intl.DateTimeFormat("pt-BR").format(new Date(props.result.completedAt));
  return <div className="hidden print:block print:text-black">
    <section className="mb-8 rounded-3xl border border-slate-300 bg-white p-8 text-slate-950">
      <div className="flex items-center justify-between gap-6"><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">InnoFlow · Fluxus Persona</p><FluxusPersonaLogo className="h-auto w-[190px] object-contain" /></div>
      <h1 className="mt-3 text-3xl font-semibold">Relatório de desenvolvimento comportamental</h1>
      <p className="mt-3 text-sm">{props.personName || "Participante"}{props.jobTitle ? ` · ${props.jobTitle}` : ""}{props.companyName ? ` · ${props.companyName}` : ""}</p>
      <div className="mt-5 grid grid-cols-3 gap-3 text-xs"><div><strong>Conclusão</strong><br />{completedDate}</div><div><strong>Instrumento</strong><br />{props.result.instrumentVersion}</div><div><strong>Fórmula</strong><br />{props.result.formulaVersion}</div></div>
      <p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-600">Documento confidencial. Este resultado apoia reflexão e desenvolvimento. Não é diagnóstico psicológico, prova de competência nem fundamento isolado para decisões de emprego.</p>
    </section>
    <section className="break-after-page"><InstrumentReport result={props.result} kind="comportamental" /></section>
    <section className="break-after-page"><InstrumentReport result={props.result} kind="tendencias" /></section>
    <section className="break-after-page"><ProfileReport result={props.result} /></section>
    <section className="break-after-page"><ComparisonReport result={props.result} /></section>
    {props.audience === "manager" ? <section className="break-after-page"><FluxusManagerGuidance result={props.result} /></section> : null}
    <FluxusReport {...props} />
  </div>;
}

export function FluxusReportTabs(props: FluxusReportProps) {
  return <><div className="print:hidden"><Tabs defaultValue="consolidada" className="space-y-5">
    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5 print:hidden">
      <TabsTrigger value="comportamental">Comportamental</TabsTrigger><TabsTrigger value="tendencias">Tendências</TabsTrigger><TabsTrigger value="perfil">Perfil Fluxus</TabsTrigger><TabsTrigger value="comparativo">Comparativo</TabsTrigger><TabsTrigger value="consolidada">Análise Consolidada</TabsTrigger>
    </TabsList>
    <TabsContent value="comportamental"><InstrumentReport result={props.result} kind="comportamental" /></TabsContent>
    <TabsContent value="tendencias"><InstrumentReport result={props.result} kind="tendencias" /></TabsContent>
    <TabsContent value="perfil"><ProfileReport result={props.result} /></TabsContent>
    <TabsContent value="comparativo"><ComparisonReport result={props.result} /></TabsContent>
    <TabsContent value="consolidada"><div className="space-y-6">{props.audience === "manager" ? <FluxusManagerGuidance result={props.result} /> : null}<FluxusReport {...props} /></div></TabsContent>
  </Tabs></div><FluxusPrintableReport {...props} /></>;
}
