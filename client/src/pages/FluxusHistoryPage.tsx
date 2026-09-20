import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { FLUXUS_DIMENSION_META } from "@shared/fluxus";
import { ArrowRight, CalendarDays, History, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function FluxusHistoryPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.fluxus.history.useQuery();
  const completed = useMemo(() => data.filter(item => item.status === "completed"), [data]);
  const [baselineId, setBaselineId] = useState(0);
  const [currentId, setCurrentId] = useState(0);
  const baseline = baselineId || completed[1]?.id || 0;
  const current = currentId || completed[0]?.id || 0;
  const compare = trpc.fluxus.compareMyAssessments.useQuery(
    { baselineAssessmentId: baseline, currentAssessmentId: current },
    { enabled: baseline > 0 && current > 0 && baseline !== current }
  );
  const startCycle = trpc.fluxus.startNewCycle.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.fluxus.me.invalidate(), utils.fluxus.history.invalidate()]);
      navigate("/fluxus/avaliacao");
    },
    onError: error => toast.error(error.message),
  });

  if (isLoading) return <Skeleton className="h-[520px] rounded-3xl" />;
  return <div className="space-y-6">
    <section className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><Badge variant="outline">Evolução</Badge><h1 className="mt-3 text-3xl font-semibold">Histórico de avaliações</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Cada ciclo concluído permanece preservado. Diferenças mostram mudanças de autorrelato e contexto; não significam melhora ou piora por si só.</p></div>
        <Button onClick={() => startCycle.mutate({})} disabled={startCycle.isPending || data.some(item => item.status === "draft")} className="gap-2"><Plus className="h-4 w-4" />{startCycle.isPending ? "Criando..." : data.some(item => item.status === "draft") ? "Há um ciclo em andamento" : "Iniciar novo ciclo"}</Button>
      </div>
    </section>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map(item => <Card key={item.id} className="border-border/60"><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Ciclo {item.cycleNumber}{item.cycleLabel ? ` · ${item.cycleLabel}` : ""}</CardTitle><Badge variant={item.status === "completed" ? "default" : "secondary"}>{item.status === "completed" ? "Concluído" : "Em andamento"}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm"><p className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" />{new Date(item.completedAt || item.startedAt).toLocaleDateString("pt-BR")}</p><p>Instrumento {item.instrumentVersion} · Fórmula {item.formulaVersion}</p>{item.predominant ? <p>Predominância: <strong>{FLUXUS_DIMENSION_META[item.predominant].label}</strong></p> : null}{item.status === "draft" ? <Button size="sm" variant="outline" onClick={() => navigate("/fluxus/avaliacao")} className="gap-2">Continuar <ArrowRight className="h-4 w-4" /></Button> : null}</CardContent></Card>)}
    </div>

    <Card className="border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5" /> Comparar ciclos</CardTitle></CardHeader><CardContent>{completed.length < 2 ? <p className="text-sm text-muted-foreground">A comparação será liberada após duas avaliações concluídas.</p> : <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><CycleSelect label="Ciclo anterior" value={baseline} items={completed} onChange={setBaselineId} /><CycleSelect label="Ciclo atual" value={current} items={completed} onChange={setCurrentId} /></div>{compare.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : compare.data ? <div><p className={`rounded-xl p-4 text-sm ${compare.data.comparable ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>{compare.data.comparable ? "Comparação exploratória: delta = ciclo atual − ciclo anterior." : "As versões são diferentes. Para preservar a integridade metodológica, a Beta 1 e a Beta 2 permanecem disponíveis no histórico, mas seus escores não são comparados numericamente."}</p>{compare.data.comparable ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{compare.data.dimensions.map(item => <div key={item.dimension} className="rounded-xl border border-border/60 p-4"><p className="font-semibold">{FLUXUS_DIMENSION_META[item.dimension].label}</p><p className="mt-2 text-sm text-muted-foreground">Anterior {item.baseline.toFixed(1)} · Atual {item.current.toFixed(1)}</p><p className="mt-2 text-lg font-bold">{item.delta > 0 ? "+" : ""}{item.delta.toFixed(1)}</p></div>)}</div> : null}</div> : null}</div>}</CardContent></Card>
  </div>;
}

function CycleSelect({ label, value, items, onChange }: { label: string; value: number; items: Array<{ id: number; cycleNumber: number; completedAt: Date | null; instrumentVersion: string }>; onChange: (value: number) => void }) {
  return <label className="text-sm"><span className="mb-2 block font-medium">{label}</span><select className="h-10 w-full rounded-md border border-input bg-background px-3" value={value} onChange={event => onChange(Number(event.target.value))}>{items.map(item => <option key={item.id} value={item.id}>Ciclo {item.cycleNumber} · v{item.instrumentVersion} · {item.completedAt ? new Date(item.completedAt).toLocaleDateString("pt-BR") : "—"}</option>)}</select></label>;
}
