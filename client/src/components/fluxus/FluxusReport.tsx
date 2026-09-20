import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FLUXUS_DIMENSIONS,
  FLUXUS_DIMENSION_META,
  getFluxusDevelopmentPriorities,
  type FluxusCoherence,
  type FluxusDimension,
  type FluxusResult,
} from "@shared/fluxus";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleGauge,
  ClipboardCheck,
  Compass,
  Handshake,
  ShieldAlert,
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

function demandCopy(dimension: FluxusDimension, demand: number) {
  const label = FLUXUS_DIMENSION_META[dimension].label;
  if (Math.abs(demand) < 1.5)
    return `${label} apresenta proximidade entre a tendência natural e a exigência percebida.`;
  if (demand > 0)
    return `A função percebida pede intensificar comportamentos de ${label}. Investigue o esforço e o apoio necessários.`;
  return `A função percebida pede conter ou modular comportamentos de ${label}. Investigue em quais situações essa modulação é útil.`;
}

function coherenceCopy(coherence: FluxusCoherence) {
  if (coherence === "Convergente")
    return "As duas leituras naturais apontam na mesma direção; a hipótese está mais consolidada para a devolutiva.";
  if (coherence === "Parcial")
    return "Há uma diferença moderada entre comportamento observado e preferência; vale confirmar em quais contextos cada lado aparece.";
  return "As duas leituras naturais diferem de forma relevante; trate o resultado como pergunta e investigue exemplos reais antes de concluir.";
}

function energyCopy(result: FluxusResult) {
  if (result.energia.faixa === "Alta")
    return "Boa disponibilidade percebida para sustentar o ritmo; monitore sobrecarga e recuperação.";
  if (result.energia.faixa === "Baixa")
    return "Disponibilidade percebida reduzida; revise volume, pausas, prioridades e condições de recuperação.";
  return "Disponibilidade percebida intermediária; acompanhe oscilações conforme o volume e a complexidade das demandas.";
}

function regulationCopy(result: FluxusResult) {
  if (result.autorregulacao.faixa === "Alta")
    return "Boa percepção de clareza e recuperação emocional diante de pressão e contratempos.";
  if (result.autorregulacao.faixa === "Baixa")
    return "Sinal para conversar sobre clareza sob pressão, pausas, apoio e recuperação após situações exigentes.";
  return "Autorregulação percebida intermediária; identifique quais situações mais afetam clareza e recuperação.";
}

function adaptationBand(distance: number) {
  if (distance <= 0.75) return "Baixa";
  if (distance <= 1.5) return "Moderada";
  return "Alta";
}

function sustainabilityCopy(result: FluxusResult) {
  if (result.sustentabilidade === "Favorável")
    return "A combinação atual entre demanda de adaptação e autorregulação não gerou alerta relevante no instrumento.";
  if (result.sustentabilidade === "Acompanhar")
    return "Existe sinal para acompanhamento: confirme esforço, frequência da adaptação e condições de suporte.";
  return "Priorize uma conversa sobre carga, esforço de adaptação, apoio e sustentabilidade do contexto atual.";
}

export function FluxusReport({
  result,
  personName,
  companyName,
  jobTitle,
  department,
}: {
  result: FluxusResult;
  personName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
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
  const priorities = getFluxusDevelopmentPriorities(result);
  const focusPriorities = priorities.slice(0, 2);
  const availableResources = [...FLUXUS_DIMENSIONS]
    .sort((a, b) => result.dimensions[b].natural - result.dimensions[a].natural)
    .slice(0, 2);
  const predominantMeta = FLUXUS_DIMENSION_META[result.predominante];
  const demandMeta = FLUXUS_DIMENSION_META[result.maiorDemanda];
  const completedDate = new Intl.DateTimeFormat("pt-BR").format(
    new Date(result.completedAt)
  );

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
              Relatório individual e plano de desenvolvimento
            </h1>
            <p className="mt-2 text-muted-foreground">
              {personName || "Colaborador"}
              {jobTitle ? ` · ${jobTitle}` : ""}
              {department ? ` · ${department}` : ""}
              {companyName ? ` · ${companyName}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Concluído em {completedDate}
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

      <section
        className={`overflow-hidden rounded-3xl border p-6 shadow-sm print:break-inside-avoid print:shadow-none sm:p-8 ${
          priorities.length
            ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card"
            : "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              priorities.length
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {priorities.length ? (
              <Compass className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Hipótese de foco
            </p>
            <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
              {priorities.length
                ? "O que precisa ser desenvolvido agora"
                : "Não há gap de adaptação relevante neste resultado"}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
              {priorities.length
                ? `${priorities.length} dimensão(ões) atingiram o limite exploratório de 1,5 ponto. Isso não significa deficiência: indica comportamentos que a função parece exigir em intensidade diferente da tendência natural. Para não dispersar o desenvolvimento, o plano abaixo prioriza ${focusPriorities.length === 1 ? "a maior demanda" : "as duas maiores demandas"}.`
                : "As exigências percebidas da função estão próximas das tendências naturais nas quatro dimensões. O foco recomendado é preservar recursos, confirmar a leitura na devolutiva e observar mudanças de contexto."}
            </p>
          </div>
        </div>

        {priorities.length > 0 && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {priorities.map((priority, index) => {
              const meta = FLUXUS_DIMENSION_META[priority.dimension];
              return (
                <div
                  key={priority.dimension}
                  className="rounded-2xl border border-border/70 bg-background/80 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge className="rounded-full">
                        Prioridade {index + 1}
                      </Badge>
                      <span className="font-semibold">{meta.label}</span>
                    </div>
                    <Badge variant="outline">
                      {priority.direction === "intensificar"
                        ? "Intensificar"
                        : "Modular"}{" "}
                      · gap {priority.gap >= 0 ? "+" : ""}
                      {priority.gap.toFixed(1)}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm font-medium leading-relaxed">
                    {priority.behavior}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Natural {priority.natural.toFixed(1)} · Função percebida{" "}
                    {priority.funcaoPercebida.toFixed(1)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {priorities.length > 0 && (
        <section className="space-y-4 print:break-before-page">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Aplicação prática
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              Foco recomendado para o próximo ciclo
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Comece pelas maiores demandas, valide cada ação com o colaborador
              e ajuste à realidade da função. Recomenda-se revisar evidências em
              30 a 45 dias antes de acrescentar outro foco.
            </p>
          </div>

          {focusPriorities.map((priority, index) => {
            const meta = FLUXUS_DIMENSION_META[priority.dimension];
            return (
              <Card
                key={priority.dimension}
                className="overflow-hidden border-border/60 print:break-inside-avoid"
              >
                <div
                  className="h-1.5"
                  style={{ backgroundColor: meta.color }}
                />
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg">
                      {index + 1}.{" "}
                      {priority.direction === "intensificar"
                        ? "Desenvolver"
                        : "Calibrar"}{" "}
                      {meta.label}
                    </CardTitle>
                    <Badge variant="secondary">
                      Revisão sugerida: 30–45 dias
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <ActionField
                    icon={Target}
                    label="Comportamento-alvo"
                    text={priority.behavior}
                  />
                  <ActionField
                    icon={ClipboardCheck}
                    label="Como praticar no trabalho"
                    text={priority.practice}
                  />
                  <ActionField
                    icon={CheckCircle2}
                    label="Evidência de evolução"
                    text={priority.indicator}
                  />
                  <ActionField
                    icon={Handshake}
                    label="Apoio recomendado do gestor"
                    text={priority.managerSupport}
                  />
                  <div className="md:col-span-2">
                    <ActionField
                      icon={ShieldAlert}
                      label="O que evitar"
                      text={priority.avoid}
                      warning
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Recursos do perfil
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            Tendências mais disponíveis para apoiar o plano
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            São preferências relativas do perfil, não comprovação automática de
            competência.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {availableResources.map(dimension => {
            const meta = FLUXUS_DIMENSION_META[dimension];
            const item = result.dimensions[dimension];
            return (
              <Card key={dimension} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{meta.label}</p>
                    <Badge variant="outline">
                      Natural {item.natural.toFixed(1)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {item.natural >= 5
                      ? meta.high
                      : item.natural <= 3
                        ? meta.low
                        : `Pontuação moderada em ${meta.label.toLowerCase()}; confirme como essa tendência varia conforme a situação.`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="border-border/60 print:break-inside-avoid">
        <CardHeader>
          <CardTitle className="text-base">
            Indicadores complementares: energia, autorregulação e adaptação
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          <IndicatorRow
            label="Energia percebida"
            value={result.energia.score.toFixed(1)}
            band={result.energia.faixa}
            reading={energyCopy(result)}
          />
          <IndicatorRow
            label="Autorregulação percebida"
            value={result.autorregulacao.score.toFixed(1)}
            band={result.autorregulacao.faixa}
            reading={regulationCopy(result)}
          />
          <IndicatorRow
            label="Pressão média de adaptação"
            value={result.distanciaMediaAdaptacao.toFixed(1)}
            band={adaptationBand(result.distanciaMediaAdaptacao)}
            reading={`${result.dimensoesComDemandaRelevante} dimensão(ões) atingiram o limite exploratório; maior gap de ${result.maiorGap.toFixed(1)}.`}
          />
          <IndicatorRow
            label="Sinal de sustentabilidade"
            value="—"
            band={result.sustentabilidade}
            reading={sustainabilityCopy(result)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 print:hidden xl:grid-cols-2">
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
                  <p>
                    {item.natural >= 5
                      ? meta.high
                      : item.natural <= 3
                        ? meta.low
                        : `Faixa moderada; confirme como ${meta.label.toLowerCase()} varia conforme a situação.`}
                  </p>
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
                <div className="rounded-xl border border-border/60 bg-background p-4 text-xs leading-relaxed text-muted-foreground">
                  <p>
                    Coerência entre instrumentos:{" "}
                    <strong className="text-foreground">
                      {item.coerencia}
                    </strong>{" "}
                    · diferença {item.diferencaInstrumentos.toFixed(1)}
                  </p>
                  <p className="mt-2">{coherenceCopy(item.coerencia)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Síntese final do perfil</CardTitle>
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
                : `${result.dimensoesComDemandaRelevante} dimensão(ões) alcançaram o limite exploratório de 1,5 ponto e foram convertidas em prioridades práticas no início deste relatório.`}
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
                <strong className="text-foreground">1.</strong> O que desta
                leitura faz sentido? Em qual situação isso não aparece?
              </li>
              <li>
                <strong className="text-foreground">2.</strong> Onde você sente
                que precisa se esforçar para agir como a função pede?
              </li>
              <li>
                <strong className="text-foreground">3.</strong> Qual é o custo
                de manter essa adaptação ao longo do tempo?
              </li>
              <li>
                <strong className="text-foreground">4.</strong> Que
                comportamento deseja preservar e qual deseja desenvolver?
              </li>
              <li>
                <strong className="text-foreground">5.</strong> Que evidência
                observável mostrará evolução nos próximos 30 a 45 dias?
              </li>
              <li>
                <strong className="text-foreground">6.</strong> Que apoio do
                gestor tornaria essa mudança viável?
              </li>
              {divergent.length > 0 && (
                <li>
                  <strong className="text-foreground">7.</strong> Por que as
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
        critério isolado de seleção, promoção ou desligamento. As prioridades
        sugeridas devem ser confirmadas com fatos do trabalho e acordadas com o
        colaborador.
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
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
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
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg ${strong ? "font-bold text-primary" : "font-semibold"}`}
      >
        {value.toFixed(1)}
      </p>
    </div>
  );
}

function ActionField({
  icon: Icon,
  label,
  text,
  warning = false,
}: {
  icon: typeof Target;
  label: string;
  text: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 ${
        warning
          ? "border-amber-500/20 bg-amber-500/5"
          : "border-border/60 bg-muted/20"
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          warning ? "text-amber-600" : "text-primary"
        }`}
      />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function IndicatorRow({
  label,
  value,
  band,
  reading,
}: {
  label: string;
  value: string;
  band: string;
  reading: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex items-center gap-2">
          {value !== "—" && (
            <span className="text-sm font-semibold text-primary">{value}</span>
          )}
          <Badge variant="outline">{band}</Badge>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {reading}
      </p>
    </div>
  );
}
