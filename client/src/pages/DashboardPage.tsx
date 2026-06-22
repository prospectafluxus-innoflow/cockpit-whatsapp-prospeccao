import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  Users,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Target,
  Layers,
  Send,
} from "lucide-react";

const DAILY_LIMIT = 30;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10`}>
          <Icon className={`h-4.5 w-4.5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

const LAYER_COLORS: Record<string, string> = {
  A: "#34d399",
  B: "#60a5fa",
  C: "#fbbf24",
};

const STATUS_COLORS: Record<string, string> = {
  novo: "#64748b",
  toque1_enviado: "#60a5fa",
  toque2_enviado: "#a78bfa",
  toque3_enviado: "#fb923c",
  respondeu: "#34d399",
  fechado: "#f472b6",
  descartado: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  toque1_enviado: "Toque 1",
  toque2_enviado: "Toque 2",
  toque3_enviado: "Toque 3",
  respondeu: "Respondeu",
  fechado: "Fechado",
  descartado: "Descartado",
};

export default function DashboardPage() {
  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const { total, byLayer, byStatus, todaySends, dailyLimit, responseRateByLayer } = metrics;

  const respondidos = byStatus["respondeu"] ?? 0;
  const taxaGeral = total > 0 ? Math.round((respondidos / total) * 100) : 0;
  const sendProgress = Math.min((todaySends / dailyLimit) * 100, 100);
  const progressColor = todaySends >= 28 ? "#ef4444" : todaySends >= 22 ? "#fbbf24" : "#34d399";

  const layerData = [
    { name: "Camada A", leads: byLayer.A, taxa: responseRateByLayer.A },
    { name: "Camada B", leads: byLayer.B, taxa: responseRateByLayer.B },
    { name: "Camada C", leads: byLayer.C, taxa: responseRateByLayer.C },
  ];

  const statusData = Object.entries(byStatus)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v, color: STATUS_COLORS[k] ?? "#64748b" }));

  const toqueData = [
    { name: "Toque 1", value: byStatus["toque1_enviado"] ?? 0 },
    { name: "Toque 2", value: byStatus["toque2_enviado"] ?? 0 },
    { name: "Toque 3", value: byStatus["toque3_enviado"] ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Métricas e progresso da sua prospecção</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total de Leads" value={total} sub="na base" />
          <StatCard
            icon={Send}
            label="Enviados Hoje"
            value={`${todaySends}/${dailyLimit}`}
            sub={todaySends >= 28 ? "⚠ Limite próximo" : "dentro do limite"}
            color={todaySends >= 28 ? "text-red-400" : todaySends >= 22 ? "text-amber-400" : "text-emerald-400"}
          />
          <StatCard
            icon={CheckCircle2}
            label="Responderam"
            value={respondidos}
            sub={`${taxaGeral}% de resposta`}
            color="text-emerald-400"
          />
          <StatCard
            icon={Target}
            label="Aguardando"
            value={(byStatus["novo"] ?? 0) + (byStatus["toque1_enviado"] ?? 0) + (byStatus["toque2_enviado"] ?? 0) + (byStatus["toque3_enviado"] ?? 0)}
            sub="na fila ativa"
            color="text-blue-400"
          />
        </div>

        {/* Limite diário */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Limite Diário de Envios</span>
            </div>
            <div className="flex items-center gap-2">
              {todaySends >= 28 && <AlertTriangle className="h-4 w-4 text-red-400" />}
              <span className="font-mono text-sm font-bold" style={{ color: progressColor }}>
                {todaySends} / {dailyLimit}
              </span>
            </div>
          </div>
          <Progress value={sendProgress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {todaySends >= dailyLimit
              ? "Limite atingido. Retome amanhã para evitar bloqueios."
              : todaySends >= 28
              ? `Atenção: apenas ${dailyLimit - todaySends} envios restantes hoje.`
              : `${dailyLimit - todaySends} envios disponíveis hoje.`}
          </p>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Taxa de resposta por camada */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Taxa de Resposta por Camada</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={layerData} barSize={36}>
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "#0f1923", border: "1px solid #1e2d3d", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "Taxa"]}
                />
                <Bar dataKey="taxa" radius={[6, 6, 0, 0]}>
                  {layerData.map((entry, i) => (
                    <Cell key={i} fill={Object.values(LAYER_COLORS)[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuição por status */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Distribuição por Status</span>
            </div>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0f1923", border: "1px solid #1e2d3d", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados ainda
              </div>
            )}
          </div>
        </div>

        {/* Progresso dos ciclos */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Progresso dos Ciclos de Abordagem</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {toqueData.map((t, i) => {
              const colors = ["#60a5fa", "#a78bfa", "#fb923c"];
              const pct = total > 0 ? Math.round((t.value / total) * 100) : 0;
              return (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t.name}</span>
                    <span className="font-mono font-semibold" style={{ color: colors[i] }}>{t.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: colors[i] }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{pct}% do total</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leads por camada */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Leads por Camada</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(["A", "B", "C"] as const).map((l) => {
              const count = byLayer[l];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const color = LAYER_COLORS[l]!;
              return (
                <div key={l} className="rounded-lg border border-border/40 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Camada {l}</p>
                  <p className="text-2xl font-bold font-mono" style={{ color }}>{count}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pct}% do total</p>
                  <p className="text-xs mt-1" style={{ color }}>
                    {responseRateByLayer[l]}% responderam
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
