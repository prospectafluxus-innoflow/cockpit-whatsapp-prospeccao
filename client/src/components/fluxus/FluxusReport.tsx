import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FLUXUS_DIMENSIONS,
  FLUXUS_DIMENSION_META,
  type FluxusDimension,
  type FluxusResult,
} from "@shared/fluxus";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CircleGauge,
  Sparkles,
  Target,
} from "lucide-react";
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

function scoreLabel(score: number) {
  if (score >= 5) return "Alta";
  if (score <= 3) return "Baixa";
  return "Moderada";
}

function demandCopy(dimension: FluxusDimension, demand: number) {
  const label = FLUXUS_DIMENSION_META[dimension].label;
  if (Math.abs(demand) < 1.5)
    return `${label} apresenta proximidade entre a tendência natural e a exigência percebida.`;
  if (demand > 0)
    return `A função percebida pede intensificar comportamentos de ${label}. Investigue o esforço e o apoio necessários.`;
  return `A função percebida pede conter ou modular comportamentos de ${label}. Investigue em quais situações essa modulação é útil.`;
}

export function FluxusReport({
  result,
  personName,
  companyName,
  jobTitle,
}: {
  result: FluxusResult;
  personName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
}) {
  const radarData = FLUXUS_DIMENSIONS.map(dimension => ({
    dimension: FLUXUS_DIMENSION_META[dimension].label,
    Natural: result.dimensions[dimension].natural,
    "Função percebida": result.dimensions[dimension].funcaoPercebida,
  }));
  const comparisonData = FLUXUS_DIMENSIONS.map(dimension => ({
    dimension: FLUXUS_DIMENSION_META[dimension].label,
    Comportamental: result.dimensions[dimension].comportamental,
    Tendências: result.dimensions[dimension].tendencias,
  }));
  const divergent = FLUXUS_DIMENSIONS.filter(
    dimension => result.dimensions[dimension].coerencia !== "Convergente"
  );
  const predominantMeta = FLUXUS_DIMENSION_META[result.predominante];
  const demandMeta = FLUXUS_DIMENSION_META[result.maiorDemanda];

  return (
    <div className="space-y-6 print:space-y-4">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm print:shadow-none">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Fluxus Persona Beta</Badge>
              <Badge variant="secondary">
                Instrumento {result.instrumentVersion}
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Relatório individual
            </h1>
            <p className="mt-2 text-muted-foreground">
              {personName || "Colaborador"}
              {jobTitle ? ` · ${jobTitle}` : ""}
              {companyName ? ` · ${companyName}` : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-primary/10 px-5 py-4 text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Predominância natural
            </p>
            <p className="mt-1 text-xl font-semibold text-primary">
              {predominantMeta.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {predominantMeta.shortLabel}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Sparkles}
          label="Perfil predominante"
          value={predominantMeta.label}
          detail={predominantMeta.definition}
        />
        <SummaryCard
          icon={Target}
          label="Maior demanda"
          value={demandMeta.label}
          detail={`Gap ${result.dimensions[result.maiorDemanda].demanda >= 0 ? "+" : ""}${result.dimensions[result.maiorDemanda].demanda.toFixed(1)}`}
        />
        <SummaryCard
          icon={Activity}
          label="Energia percebida"
          value={`${result.energia.score.toFixed(1)} · ${result.energia.faixa}`}
          detail="Autorrelato contextual das últimas semanas."
        />
        <SummaryCard
          icon={CircleGauge}
          label="Sustentabilidade"
          value={result.sustentabilidade}
          detail="Sinal para investigação; não é diagnóstico de saúde ou estresse."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              Natural × exigência percebida da função
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <Radar
                  name="Natural"
                  dataKey="Natural"
                  stroke="#43a97b"
                  fill="#43a97b"
                  fillOpacity={0.28}
                />
                <Radar
                  name="Função percebida"
                  dataKey="Função percebida"
                  stroke="#4f82d1"
                  fill="#4f82d1"
                  fillOpacity={0.16}
                />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              Coerência entre as duas leituras naturais
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonData}
                margin={{ top: 8, right: 12, left: -18, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="dimension"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <YAxis
                  domain={[1, 7]}
                  ticks={[1, 2, 3, 4, 5, 6, 7]}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="Comportamental"
                  fill="#43a97b"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="Tendências"
                  fill="#f6b44c"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {FLUXUS_DIMENSIONS.map(dimension => {
          const meta = FLUXUS_DIMENSION_META[dimension];
          const item = result.dimensions[dimension];
          const DemandIcon = item.demanda >= 0 ? ArrowUp : ArrowDown;
          return (
            <Card key={dimension} className="overflow-hidden border-border/60">
              <div className="h-1.5" style={{ backgroundColor: meta.color }} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{meta.label}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {meta.definition}
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.faixaNatural === "Alta" ? "default" : "secondary"
                    }
                  >
                    {item.faixaNatural}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Comportamental" value={item.comportamental} />
                  <Metric label="Tendências" value={item.tendencias} />
                  <Metric label="Natural" value={item.natural} strong />
                </div>
                <div className="rounded-xl bg-muted/50 p-4 text-sm">
                  <p>{item.natural >= 4 ? meta.high : meta.low}</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border/60 p-4">
                  <DemandIcon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${Math.abs(item.demanda) >= 1.5 ? "text-amber-500" : "text-muted-foreground"}`}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      Demanda {item.demanda >= 0 ? "+" : ""}
                      {item.demanda.toFixed(1)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {demandCopy(dimension, item.demanda)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Coerência entre instrumentos:{" "}
                  <strong className="text-foreground">{item.coerencia}</strong>{" "}
                  · diferença {item.diferencaInstrumentos.toFixed(1)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Leitura integrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              O resultado sugere predominância de{" "}
              <strong className="text-foreground">
                {predominantMeta.label}
              </strong>
              . Isso indica uma preferência relativa dentro deste perfil, e não
              uma identidade fixa ou uma competência garantida.
            </p>
            <p>
              A distância média entre o natural e a exigência percebida da
              função foi{" "}
              <strong className="text-foreground">
                {result.distanciaMediaAdaptacao.toFixed(1)}
              </strong>
              .{" "}
              {result.dimensoesComDemandaRelevante === 0
                ? "Não houve dimensão acima do limite exploratório de 1,5 ponto."
                : `${result.dimensoesComDemandaRelevante} dimensão(ões) alcançaram o limite exploratório de 1,5 ponto.`}
            </p>
            <p>
              Energia percebida:{" "}
              <strong className="text-foreground">
                {result.energia.score.toFixed(1)} ({result.energia.faixa})
              </strong>
              . Autorregulação percebida:{" "}
              <strong className="text-foreground">
                {result.autorregulacao.score.toFixed(1)} (
                {result.autorregulacao.faixa})
              </strong>
              . Esses indicadores descrevem o momento relatado e não substituem
              avaliação profissional de saúde.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              Perguntas para a devolutiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">1.</strong> Em quais
                situações sua predominância de {predominantMeta.label} mais
                contribui para o resultado?
              </li>
              <li>
                <strong className="text-foreground">2.</strong> O que a função
                exige em {demandMeta.label} que hoje demanda esforço consciente?
              </li>
              <li>
                <strong className="text-foreground">3.</strong> Essa adaptação é
                sustentável? Que apoio, processo ou aprendizado reduziria o
                custo?
              </li>
              {divergent.length > 0 && (
                <li>
                  <strong className="text-foreground">4.</strong> Por que as
                  leituras diferem em{" "}
                  {divergent
                    .map(d => FLUXUS_DIMENSION_META[d].label)
                    .join(", ")}
                  ? O contexto explica essa diferença?
                </li>
              )}
            </ol>
          </CardContent>
        </Card>
      </div>

      <aside className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Limite de interpretação.</strong> A
        Fluxus Persona Beta é uma ferramenta autoral de reflexão comportamental
        e apoio à devolutiva. O cruzamento entre leituras é heurístico, não
        representa diagnóstico psicológico e não deve ser utilizado como
        critério isolado de seleção, promoção ou desligamento.
      </aside>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p className="mt-3 text-lg font-semibold">{value}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${strong ? "bg-primary/10" : "bg-muted/50"}`}
    >
      <p className={`text-lg font-semibold ${strong ? "text-primary" : ""}`}>
        {value.toFixed(1)}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {scoreLabel(value)}
      </p>
    </div>
  );
}
