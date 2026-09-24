import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function FluxusAdminPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading, isFetching, error, refetch } =
    trpc.fluxus.adminOverview.useQuery(undefined, {
      retry: 1,
      refetchOnWindowFocus: false,
    });
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [accessCode, setAccessCode] = useState("");

  const create = trpc.fluxus.createCompany.useMutation({
    onSuccess: async created => {
      toast.success(
        `Empresa ${created.company.name} criada. Compartilhe o código por canal seguro.`
      );
      setName("");
      setAccessCode("");
      setDialogOpen(false);
      await utils.fluxus.adminOverview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const setActive = trpc.fluxus.setCompanyActive.useMutation({
    onSuccess: () => utils.fluxus.adminOverview.invalidate(),
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!isLoading) {
      setLoadingSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadingSlow(true), 5000);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  if (isLoading)
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
        {loadingSlow ? (
          <Card className="border-amber-500/30">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              <div>
                <p className="font-medium">O painel está demorando para responder</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você pode tentar novamente sem perder nenhuma informação.
                </p>
              </div>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );

  if (error || !data)
    return (
      <div className="p-6">
        <Card className="mx-auto max-w-xl border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h1 className="text-lg font-semibold">
                Não foi possível carregar o painel
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {error?.message || "A consulta não retornou dados."}
              </p>
            </div>
            <Button
              className="gap-2"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  const submit = () => {
    if (!name.trim() || accessCode.trim().length < 8)
      return toast.error(
        "Informe a empresa e um código com ao menos 8 caracteres."
      );
    create.mutate({ name, accessCode });
  };

  return (
    <div className="min-h-full bg-muted/20 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] bg-[#102722] p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                InnoFlow · Administração
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                Fluxus Persona
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-50/65">
                Cadastre empresas, acompanhe o preenchimento e acesse relatórios
                individuais ou consolidados.
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                  <Plus className="h-4 w-4" /> Nova empresa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar empresa</DialogTitle>
                  <DialogDescription>
                    O código vincula o colaborador à empresa correta e continuará
                    disponível para consulta administrativa.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Nome da empresa</Label>
                    <Input
                      id="company-name"
                      value={name}
                      onChange={event => setName(event.target.value)}
                      placeholder="Empresa Exemplo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-code">Código de acesso</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="company-code"
                        value={accessCode}
                        onChange={event => setAccessCode(event.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Envie o código aos colaboradores por canal seguro. O banco
                      guarda o código com criptografia e mantém o hash para validação.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={submit} disabled={create.isPending}>
                    {create.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Criar empresa
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            icon={Building2}
            label="Empresas"
            value={data.totals.companies}
          />
          <Metric
            icon={CheckCircle2}
            label="Empresas ativas"
            value={data.totals.activeCompanies}
          />
          <Metric
            icon={UsersRound}
            label="Colaboradores"
            value={data.totals.collaborators}
          />
          <Metric
            icon={ClipboardList}
            label="Concluídas"
            value={data.totals.completed}
          />
          <Metric
            icon={ClipboardList}
            label="Em andamento"
            value={data.totals.inProgress}
          />
        </div>

        <Card className="overflow-hidden border-border/60 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Empresas e avaliações</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                O agrupamento é feito pelo identificador interno da empresa, não
                pelo texto digitado em relatórios.
              </p>
            </div>
            <Badge variant="outline">Beta 1.0</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="hidden md:table-cell">
                  Colaboradores
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  Conclusão
                </TableHead>
                <TableHead className="hidden lg:table-cell">Código</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Abrir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.companies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Nenhuma empresa cadastrada. Crie a primeira para liberar o
                    cadastro de colaboradores.
                  </TableCell>
                </TableRow>
              ) : (
                data.companies.map(company => (
                  <TableRow
                    key={company.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(`/fluxus/admin/empresa/${company.id}`)
                    }
                  >
                    <TableCell>
                      <p className="font-medium">{company.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {company.completed} concluída(s) · {company.inProgress}{" "}
                        em andamento
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {company.collaborators}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex min-w-32 items-center gap-3">
                        <Progress
                          value={company.completionRate}
                          className="h-2"
                        />
                        <span className="w-10 text-xs font-medium">
                          {company.completionRate}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                      {company.accessCodeHint || "Protegido"}
                    </TableCell>
                    <TableCell onClick={event => event.stopPropagation()}>
                      <Switch
                        checked={company.active === 1}
                        onCheckedChange={active =>
                          setActive.mutate({ companyId: company.id, active })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <ArrowRight className="h-4 w-4" />
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
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
