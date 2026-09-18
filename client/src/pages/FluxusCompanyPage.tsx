import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { FLUXUS_DIMENSIONS, FLUXUS_DIMENSION_META } from "@shared/fluxus";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Eye,
  KeyRound,
  Loader2,
  LockKeyhole,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocation } from "wouter";

export default function FluxusCompanyPage({
  params,
}: {
  params: { id: string };
}) {
  const companyId = Number(params.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.fluxus.adminCompany.useQuery(
    { companyId },
    { enabled: Number.isInteger(companyId) && companyId > 0 }
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const resetCode = trpc.fluxus.resetCompanyCode.useMutation({
    onSuccess: async () => {
      toast.success(
        "Código atualizado. Compartilhe o novo código por canal seguro."
      );
      setNewCode("");
      setDialogOpen(false);
      await utils.fluxus.adminOverview.invalidate();
    },
    onError: mutationError => toast.error(mutationError.message),
  });

  if (isLoading)
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  if (error || !data)
    return (
      <div className="p-8 text-sm text-destructive">
        {error?.message || "Empresa não encontrada."}
      </div>
    );

  const chartData = FLUXUS_DIMENSIONS.map(dimension => ({
    dimension: FLUXUS_DIMENSION_META[dimension].label,
    Natural: data.summary.averages[dimension].natural,
    "Função percebida": data.summary.averages[dimension].funcao,
  }));
  const canAggregate = data.summary.completed >= 3;

  return (
    <div className="min-h-full bg-muted/20 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/fluxus/admin")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar às empresas
        </Button>

        <section className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Empresa</Badge>
                <Badge
                  variant={data.company.active === 1 ? "default" : "secondary"}
                >
                  {data.company.active === 1 ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {data.company.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Acompanhamento das avaliações vinculadas pelo identificador
                interno da empresa.
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <KeyRound className="h-4 w-4" /> Redefinir código
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo código da empresa</DialogTitle>
                  <DialogDescription>
                    O código anterior deixará de funcionar para novos cadastros.
                    Colaboradores já vinculados não serão afetados.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-3">
                  <Label htmlFor="new-code">Novo código</Label>
                  <Input
                    id="new-code"
                    value={newCode}
                    onChange={event => setNewCode(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() =>
                      resetCode.mutate({ companyId, accessCode: newCode })
                    }
                    disabled={newCode.length < 8 || resetCode.isPending}
                  >
                    {resetCode.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Atualizar código
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={UsersRound}
            label="Colaboradores"
            value={data.summary.collaborators}
          />
          <Metric
            icon={CheckCircle2}
            label="Concluídas"
            value={data.summary.completed}
          />
          <Metric
            icon={BarChart3}
            label="Em andamento"
            value={data.summary.inProgress}
          />
          <Card className="border-border/60">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Taxa de conclusão
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {data.summary.completionRate}%
              </p>
              <Progress
                value={data.summary.completionRate}
                className="mt-3 h-2"
              />
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  Visão consolidada da empresa
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Médias exibidas somente a partir de três avaliações
                  concluídas.
                </p>
              </div>
              {canAggregate ? (
                <Badge variant="secondary">
                  {data.summary.completed} respostas
                </Badge>
              ) : (
                <LockKeyhole className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {canAggregate ? (
              <div className="grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ left: -18, right: 12 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="dimension"
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                      />
                      <YAxis domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="Natural"
                        fill="#43a97b"
                        radius={[5, 5, 0, 0]}
                      />
                      <Bar
                        dataKey="Função percebida"
                        fill="#4f82d1"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {FLUXUS_DIMENSIONS.map(dimension => (
                    <div
                      key={dimension}
                      className="rounded-xl border border-border/60 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {FLUXUS_DIMENSION_META[dimension].label}
                        </span>
                        <span className="text-sm font-semibold">
                          {data.summary.predominantCount[dimension]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        perfil(is) com esta predominância
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <LockKeyhole className="h-9 w-9 text-muted-foreground" />
                <h3 className="mt-4 font-medium">Consolidado protegido</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  São necessárias três avaliações concluídas para reduzir a
                  identificação indireta de respostas individuais. Os relatórios
                  individuais autorizados continuam disponíveis abaixo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60 shadow-sm">
          <div className="border-b border-border/60 p-5">
            <h2 className="font-semibold">Colaboradores</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Acesse o relatório somente para a finalidade de devolutiva e
              desenvolvimento definida.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="hidden md:table-cell">
                  Cargo / área
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Conclusão
                </TableHead>
                <TableHead className="text-right">Relatório</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.people.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-28 text-center text-muted-foreground"
                  >
                    Nenhum colaborador vinculado.
                  </TableCell>
                </TableRow>
              ) : (
                data.people.map(person => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <p className="font-medium">{person.name || "Sem nome"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {person.email}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-sm">
                        {person.jobTitle || "Não informado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {person.department || "Sem área"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Status value={person.assessmentStatus} />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {person.completedAt
                        ? new Date(person.completedAt).toLocaleDateString(
                            "pt-BR"
                          )
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          !person.assessmentId ||
                          person.assessmentStatus !== "completed"
                        }
                        onClick={() =>
                          navigate(
                            `/fluxus/admin/relatorio/${person.assessmentId}`
                          )
                        }
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="hidden sm:inline">Abrir</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
function Status({ value }: { value: "draft" | "completed" | "not_started" }) {
  const map = {
    completed: ["Concluída", "default"],
    draft: ["Em andamento", "secondary"],
    not_started: ["Não iniciada", "outline"],
  } as const;
  return <Badge variant={map[value][1]}>{map[value][0]}</Badge>;
}
