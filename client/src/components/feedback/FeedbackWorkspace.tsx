import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { feedbackApi, type FeedbackWorkspace } from "@/lib/feedbackApi";
import { feedbackAvailabilityMessage } from "@/lib/feedbackAvailability";
import {
  CYCLE_STATUS_LABELS,
  FEEDBACK_PURPOSE,
  FEEDBACK_ROLE_LABELS,
  isFeedbackVisibleToParticipant,
  type FeedbackRole,
} from "@shared/feedback";
import type { DevelopmentCycle } from "../../../../drizzle/feedbackSchema";
import {
  ClipboardCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  History,
  Info,
  LockKeyhole,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  EmptyState,
  CycleStatusBadge,
  LoadingCards,
  Metric,
  PageHeader,
  QueryFailure,
  errorMessage,
  formatDate,
  nextQuarterStart,
  addMonths,
} from "./FeedbackShared";

export default function FeedbackWorkspacePage() {
  const query = feedbackApi.workspace.useQuery({}, { retry: false });
  const data = query.data;
  const [section, setSection] = useState<"cycles" | "organization">("cycles");
  if (query.isLoading) return <LoadingCards count={4} />;
  if (query.error || !data)
    return (
      <QueryFailure
        error={query.error}
        onRetry={() => void query.refetch()}
        message="Não foi possível carregar o workspace de feedback."
      />
    );
  if (!data.enabled) return <FeedbackOnboarding workspace={data} />;
  if (!data.companyId) return <FeedbackOnboarding workspace={data} />;
  const pendingCorrections =
    "pendingCorrections" in data ? data.pendingCorrections : 0;
  return (
    <div className="space-y-6">
      {" "}
      <PageHeader
        eyebrow="Fluxus Feedback · EEC"
        title="Feedback de desenvolvimento"
        description={FEEDBACK_PURPOSE}
      >
        {" "}
        <Link href="/fluxus/feedback/historico">
          <Button variant="outline" className="gap-2">
            <History className="h-4 w-4" /> Histórico
          </Button>
        </Link>{" "}
        {data.canConfigure ? (
          <Button
            onClick={() =>
              setSection(section === "cycles" ? "organization" : "cycles")
            }
            variant="outline"
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />{" "}
            {section === "cycles" ? "Organização" : "Ciclos"}
          </Button>
        ) : null}{" "}
      </PageHeader>{" "}
      {pendingCorrections > 0 ? (
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4" />
          <AlertTitle>Há uma devolutiva sendo revisada</AlertTitle>
          <AlertDescription>
            {pendingCorrections === 1
              ? "Uma avaliação recebeu uma correção e terá uma nova devolutiva antes de aparecer novamente."
              : `${pendingCorrections} avaliações receberam correções e terão novas devolutivas antes de aparecerem novamente.`}{" "}
            Nenhuma nota ou item novo é mostrado aqui enquanto a revisão não for
            liberada.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {" "}
        <Metric
          icon={ClipboardCheck}
          label="Ciclos"
          value={data.cycles.length}
        />{" "}
        <Metric
          icon={UsersRound}
          label="Pessoas no escopo"
          value={data.people.length}
        />{" "}
        <Metric
          icon={CheckCircle2}
          label="Avaliações liberadas"
          value={
            data.feedbacks.filter(item =>
              isFeedbackVisibleToParticipant(item.status)
            ).length
          }
        />{" "}
        <Metric
          icon={ShieldCheck}
          label="Acesso de conteúdo"
          value={data.canReadContent ? "Autorizado" : "Próprios registros"}
        />{" "}
      </div>{" "}
      {section === "cycles" ? (
        <WorkspaceCycles
          workspace={data}
          onRefresh={() => void query.refetch()}
        />
      ) : (
        <FeedbackOrganization
          workspace={data}
          onRefresh={() => void query.refetch()}
        />
      )}{" "}
    </div>
  );
}
function FeedbackOnboarding({ workspace }: { workspace: FeedbackWorkspace }) {
  const message = feedbackAvailabilityMessage(workspace);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fluxus Feedback · EEC"
        title={message.title}
        description={message.description}
      />
      <Card className="border-emerald-700/20 bg-emerald-500/5">
        <CardContent className="flex gap-4 p-6 sm:p-8">
          <Info className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-semibold">Próximo passo</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {message.nextStep}
            </p>
            {workspace.companyId ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Empresa vinculada: #{workspace.companyId}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
function WorkspaceCycles({
  workspace,
  onRefresh,
}: {
  workspace: FeedbackWorkspace;
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("Feedback trimestral");
  const [startsOn, setStartsOn] = useState(nextQuarterStart());
  const [endsOn, setEndsOn] = useState(addMonths(nextQuarterStart(), 3));
  const createCycle = feedbackApi.createCycle.useMutation();
  const updateSettings = feedbackApi.updateSettings.useMutation();
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>(
    workspace.settings?.competencyIds ?? workspace.catalog.map(item => item.id)
  );
  const [showTemplate, setShowTemplate] = useState(false);
  useEffect(
    () =>
      setSelectedCompetencies(
        workspace.settings?.competencyIds ??
          workspace.catalog.map(item => item.id)
      ),
    [workspace.settings, workspace.catalog]
  );
  const submitCycle = async () => {
    if (!workspace.companyId || !name.trim() || !startsOn || !endsOn) return;
    if (endsOn < startsOn) {
      toast.error("A data final deve ser igual ou posterior à data inicial.");
      return;
    }
    try {
      await createCycle.mutateAsync({
        companyId: workspace.companyId,
        name: name.trim(),
        startsOn,
        endsOn,
      });
      toast.success("Ciclo criado com sucesso.");
      setShowCreate(false);
      onRefresh();
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível criar o ciclo."));
    }
  };
  const saveSettings = async () => {
    if (
      !workspace.companyId ||
      selectedCompetencies.length < 1 ||
      selectedCompetencies.length > 10
    )
      return;
    try {
      await updateSettings.mutateAsync({
        companyId: workspace.companyId,
        competencyIds: selectedCompetencies,
      });
      toast.success("Template atualizado para os próximos ciclos.");
      onRefresh();
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível salvar o template."));
    }
  };
  return (
    <div className="space-y-6">
      {" "}
      {workspace.canConfigure ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          {" "}
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Novo ciclo</CardTitle>
                  <CardDescription>
                    Sugestão inicial trimestral; as datas permanecem
                    configuráveis.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreate(!showCreate)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" /> {showCreate ? "Fechar" : "Criar"}
                </Button>
              </div>
            </CardHeader>
            {showCreate ? (
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="cycle-name">Nome do ciclo</Label>
                  <Input
                    id="cycle-name"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cycle-start">Início</Label>
                  <Input
                    id="cycle-start"
                    type="date"
                    value={startsOn}
                    onChange={event => {
                      setStartsOn(event.target.value);
                      setEndsOn(addMonths(event.target.value, 3));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cycle-end">Fim</Label>
                  <Input
                    id="cycle-end"
                    type="date"
                    value={endsOn}
                    onChange={event => setEndsOn(event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    onClick={() => void submitCycle()}
                    disabled={createCycle.isPending || !name.trim()}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />{" "}
                    {createCycle.isPending
                      ? "Criando…"
                      : "Criar ciclo planejado"}
                  </Button>
                </div>
              </CardContent>
            ) : null}
          </Card>{" "}
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Template EEC</CardTitle>
                  <CardDescription>
                    {selectedCompetencies.length} de 10 competências no próximo
                    ciclo · versão {workspace.settings?.version ?? 1}.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTemplate(!showTemplate)}
                  className="gap-2"
                >
                  <SlidersHorizontal className="h-4 w-4" />{" "}
                  {showTemplate ? "Fechar" : "Configurar"}
                </Button>
              </div>
            </CardHeader>
            {showTemplate ? (
              <CardContent className="space-y-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  O catálogo é fechado e não permite competências ou pesos
                  personalizados. Alterar o template não muda ciclos já criados.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {workspace.catalog.map(competency => (
                    <label
                      key={competency.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3"
                    >
                      <Checkbox
                        checked={selectedCompetencies.includes(competency.id)}
                        onCheckedChange={checked =>
                          setSelectedCompetencies(current =>
                            checked === true
                              ? [...current, competency.id]
                              : current.filter(id => id !== competency.id)
                          )
                        }
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {competency.name}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {competency.definition}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <Button
                  onClick={() => void saveSettings()}
                  disabled={
                    updateSettings.isPending ||
                    selectedCompetencies.length === 0
                  }
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />{" "}
                  {updateSettings.isPending ? "Salvando…" : "Salvar template"}
                </Button>
              </CardContent>
            ) : null}
          </Card>{" "}
        </div>
      ) : (
        <Alert>
          <LockKeyhole className="h-4 w-4" />
          <AlertTitle>Acesso operacional restrito</AlertTitle>
          <AlertDescription>
            Você pode consultar somente o conteúdo liberado para sua função.
            Configuração de ciclos e template exige membership explícito.
          </AlertDescription>
        </Alert>
      )}{" "}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Ciclos de desenvolvimento</CardTitle>
          <CardDescription>
            Cada ciclo preserva seu snapshot de competências, versão e período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspace.cycles.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Nenhum ciclo criado"
              description="Quando um administrador criar o primeiro ciclo, ele aparecerá aqui para planejamento e acompanhamento."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {workspace.cycles.map(cycle => (
                <CycleCard
                  key={cycle.id}
                  cycle={cycle}
                  feedbackCount={
                    workspace.feedbacks.filter(
                      item => item.cycleId === cycle.id
                    ).length
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>{" "}
    </div>
  );
}
function CycleCard({
  cycle,
  feedbackCount,
}: {
  cycle: DevelopmentCycle;
  feedbackCount: number;
}) {
  return (
    <Link href={`/fluxus/feedback/ciclo/${cycle.id}`} className="block">
      <div className="group rounded-2xl border border-border/60 p-5 transition-colors hover:border-primary/50 hover:bg-muted/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {cycle.year} · {formatDate(cycle.startsOn)} a{" "}
              {formatDate(cycle.endsOn)}
            </p>
            <h3 className="mt-2 font-semibold">{cycle.name}</h3>
          </div>
          <CycleStatusBadge status={cycle.status} />
        </div>
        <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
          <span>{feedbackCount} avaliação(ões) atribuída(s)</span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
export function FeedbackOrganization({
  workspace,
  onRefresh,
}: {
  workspace: FeedbackWorkspace;
  onRefresh: () => void;
}) {
  if (!workspace.companyId) return null;
  return (
    <div className="space-y-6">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Permissões explícitas</AlertTitle>
        <AlertDescription>
          Membership, escopo, cargo e direito de leitura são registros
          independentes. O papel legado da conta não concede acesso automático a
          notas.
        </AlertDescription>
      </Alert>
      <div className="grid gap-6 xl:grid-cols-2">
        <DepartmentManager workspace={workspace} onRefresh={onRefresh} />
        <AssignmentManager workspace={workspace} onRefresh={onRefresh} />
        {workspace.membership?.role === "company_admin" ? (
          <MembershipManager workspace={workspace} onRefresh={onRefresh} />
        ) : (
          <MembershipAdminOnlyNotice />
        )}
        <ScopeManager workspace={workspace} onRefresh={onRefresh} />
      </div>
    </div>
  );
}
function MembershipAdminOnlyNotice() {
  return (
    <Alert>
      <ShieldCheck className="h-4 w-4" />
      <AlertTitle>
        Memberships definidos pelo administrador da empresa
      </AlertTitle>
      <AlertDescription>
        Somente o administrador da empresa pode definir papéis e o direito de
        leitura de conteúdo. O RH pode continuar gerenciando departamentos,
        atribuições e escopos.
      </AlertDescription>
    </Alert>
  );
}
function DepartmentManager({
  workspace,
  onRefresh,
}: {
  workspace: FeedbackWorkspace;
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const create = feedbackApi.createDepartment.useMutation();
  const update = feedbackApi.updateDepartment.useMutation();
  const submitCreate = async () => {
    if (!workspace.companyId || !name.trim()) return;
    try {
      await create.mutateAsync({
        companyId: workspace.companyId,
        name: name.trim(),
        parentId: parentId === "none" ? null : Number(parentId),
      });
      toast.success("Departamento criado.");
      setName("");
      onRefresh();
    } catch (error) {
      toast.error(
        errorMessage(error, "Não foi possível criar o departamento.")
      );
    }
  };
  const submitUpdate = async (
    departmentId: number,
    active: boolean,
    currentParentId: number | null
  ) => {
    if (!editingName.trim()) return;
    try {
      await update.mutateAsync({
        id: departmentId,
        name: editingName.trim(),
        parentId: currentParentId,
        active,
      });
      toast.success("Departamento atualizado.");
      setEditingId(null);
      onRefresh();
    } catch (error) {
      toast.error(
        errorMessage(error, "Não foi possível atualizar o departamento.")
      );
    }
  };
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings2 className="h-5 w-5 text-primary" /> Departamentos
        </CardTitle>
        <CardDescription>
          Organize áreas hierárquicas e mantenha o histórico de alterações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor="new-department">Novo departamento</Label>
            <Input
              id="new-department"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Ex.: Operações"
            />
          </div>
          <div className="space-y-2">
            <Label>Departamento-pai</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sem departamento-pai" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem departamento-pai</SelectItem>
                {workspace.departments
                  .filter(item => item.active)
                  .map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="mt-auto gap-2"
            onClick={() => void submitCreate()}
            disabled={create.isPending || !name.trim()}
          >
            <Plus className="h-4 w-4" /> Criar
          </Button>
        </div>
        <div className="space-y-2">
          {workspace.departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum departamento cadastrado.
            </p>
          ) : (
            workspace.departments.map(department => (
              <div
                key={department.id}
                className="rounded-xl border border-border/60 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  {editingId === department.id ? (
                    <Input
                      value={editingName}
                      onChange={event => setEditingName(event.target.value)}
                      aria-label={`Nome de ${department.name}`}
                    />
                  ) : (
                    <div>
                      <p className="text-sm font-medium">{department.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {department.parentId
                          ? `Subdepartamento de #${department.parentId}`
                          : "Raiz"}
                      </p>
                    </div>
                  )}
                  <div className="flex shrink-0 gap-2">
                    {editingId === department.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            void submitUpdate(
                              department.id,
                              department.active,
                              department.parentId
                            )
                          }
                          disabled={update.isPending}
                        >
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge
                          variant={department.active ? "default" : "secondary"}
                        >
                          {department.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(department.id);
                            setEditingName(department.name);
                          }}
                        >
                          Editar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
function AssignmentManager({
  workspace,
  onRefresh,
}: {
  workspace: FeedbackWorkspace;
  onRefresh: () => void;
}) {
  const [userId, setUserId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState("none");
  const [managerUserId, setManagerUserId] = useState("none");
  const [jobTitle, setJobTitle] = useState("");
  const assign = feedbackApi.assignEmployee.useMutation();
  const submit = async () => {
    if (!workspace.companyId || !userId) return;
    try {
      await assign.mutateAsync({
        companyId: workspace.companyId,
        userId: Number(userId),
        departmentId: departmentId === "none" ? null : Number(departmentId),
        managerUserId: managerUserId === "none" ? null : Number(managerUserId),
        jobTitle: jobTitle.trim() || undefined,
      });
      toast.success("Atribuição atualizada.");
      onRefresh();
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível atribuir a pessoa."));
    }
  };
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UsersRound className="h-5 w-5 text-primary" /> Atribuições
        </CardTitle>
        <CardDescription>
          Defina área, cargo e gestor atual. O backend impede autoatribuição e
          ciclos de liderança.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Pessoa</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma pessoa" />
              </SelectTrigger>
              <SelectContent>
                {workspace.people.map(person => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    {person.name || `Usuário #${person.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem departamento</SelectItem>
                {workspace.departments
                  .filter(item => item.active)
                  .map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gestor</Label>
            <Select value={managerUserId} onValueChange={setManagerUserId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem gestor</SelectItem>
                {workspace.people
                  .filter(person => String(person.id) !== userId)
                  .map(person => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name || `Usuário #${person.id}`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="job-title">Cargo (opcional)</Label>
            <Input
              id="job-title"
              value={jobTitle}
              onChange={event => setJobTitle(event.target.value)}
              maxLength={180}
            />
          </div>
        </div>
        <Button
          onClick={() => void submit()}
          disabled={assign.isPending || !userId}
          className="gap-2"
        >
          <Save className="h-4 w-4" />{" "}
          {assign.isPending ? "Salvando…" : "Salvar atribuição"}
        </Button>
        <div className="space-y-2 border-t border-border/60 pt-4">
          {workspace.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma atribuição atual disponível.
            </p>
          ) : (
            workspace.assignments.map(assignment => (
              <div
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm"
              >
                <span>
                  Usuário #{assignment.userId} ·{" "}
                  {assignment.jobTitle || "Cargo não informado"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {assignment.departmentId
                    ? `Dept. #${assignment.departmentId}`
                    : "Sem departamento"}
                  {assignment.managerUserId
                    ? ` · Gestor #${assignment.managerUserId}`
                    : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
function MembershipManager({
  workspace,
  onRefresh,
}: {
  workspace: FeedbackWorkspace;
  onRefresh: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<FeedbackRole>("collaborator");
  const [canRead, setCanRead] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const mutation = feedbackApi.setMembership.useMutation();
  const submit = async () => {
    if (!workspace.companyId || !userId || !confirmed) return;
    try {
      await mutation.mutateAsync({
        companyId: workspace.companyId,
        userId: Number(userId),
        role,
        canReadFeedback: canRead,
      });
      toast.success("Membership atualizado com trilha de auditoria.");
      setConfirmed(false);
      onRefresh();
    } catch (error) {
      toast.error(
        errorMessage(error, "Não foi possível atualizar o membership.")
      );
    }
  };
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" /> Memberships
          explícitos
        </CardTitle>
        <CardDescription>
          Alterações de papel e leitura exigem confirmação intencional. Não
          modificam users.role ou fluxusRole.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Pessoa</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma pessoa" />
              </SelectTrigger>
              <SelectContent>
                {workspace.people.map(person => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    {person.name || `Usuário #${person.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Papel do módulo</Label>
            <Select
              value={role}
              onValueChange={value => setRole(value as FeedbackRole)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FEEDBACK_ROLE_LABELS) as FeedbackRole[]).map(
                  item => (
                    <SelectItem key={item} value={item}>
                      {FEEDBACK_ROLE_LABELS[item]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
          <Checkbox
            checked={canRead}
            onCheckedChange={value => setCanRead(value === true)}
          />
          <span>
            <span className="block text-sm font-medium">
              Pode ler conteúdo organizacional
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Notas e evidências só ficam disponíveis com este direito e escopo.
              Para colaborador, mantenha desmarcado.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <Checkbox
            checked={confirmed}
            onCheckedChange={value => setConfirmed(value === true)}
          />
          <span className="text-sm leading-relaxed">
            Confirmo o papel <strong>{FEEDBACK_ROLE_LABELS[role]}</strong> e o
            direito de leitura {canRead ? "ATIVADO" : "DESATIVADO"} para a
            pessoa selecionada.
          </span>
        </label>
        <Button
          onClick={() => void submit()}
          disabled={mutation.isPending || !userId || !confirmed}
          className="gap-2"
        >
          <Check className="h-4 w-4" />{" "}
          {mutation.isPending ? "Aplicando…" : "Aplicar membership"}
        </Button>
      </CardContent>
    </Card>
  );
}
function ScopeManager({
  workspace,
  onRefresh,
}: {
  workspace: FeedbackWorkspace;
  onRefresh: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [active, setActive] = useState(true);
  const mutation = feedbackApi.setManagementScope.useMutation();
  const submit = async () => {
    if (!workspace.companyId || !userId || !departmentId) return;
    try {
      await mutation.mutateAsync({
        companyId: workspace.companyId,
        userId: Number(userId),
        departmentId: Number(departmentId),
        includeDescendants,
        active,
      });
      toast.success("Escopo gerencial salvo.");
      onRefresh();
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível salvar o escopo."));
    }
  };
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <SlidersHorizontal className="h-5 w-5 text-primary" /> Escopo de
          gestão
        </CardTitle>
        <CardDescription>
          Supergestores precisam de departamentos atribuídos; descendentes são
          uma opção explícita.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Gestor</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma pessoa" />
              </SelectTrigger>
              <SelectContent>
                {workspace.people.map(person => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    {person.name || `Usuário #${person.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Departamento no escopo</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um departamento" />
              </SelectTrigger>
              <SelectContent>
                {workspace.departments
                  .filter(item => item.active)
                  .map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={includeDescendants}
              onCheckedChange={setIncludeDescendants}
            />{" "}
            Incluir descendentes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> Escopo ativo
          </label>
        </div>
        <Button
          onClick={() => void submit()}
          disabled={mutation.isPending || !userId || !departmentId}
          className="gap-2"
        >
          <Save className="h-4 w-4" /> Salvar escopo
        </Button>
        <div className="space-y-2 border-t border-border/60 pt-4">
          {workspace.scopes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum escopo explícito cadastrado.
            </p>
          ) : (
            workspace.scopes.map(scope => (
              <div
                key={scope.id}
                className="rounded-xl border border-border/60 p-3 text-sm"
              >
                Usuário #{scope.userId} · Departamento #{scope.departmentId} ·{" "}
                {scope.includeDescendants
                  ? "inclui descendentes"
                  : "somente departamento"}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
