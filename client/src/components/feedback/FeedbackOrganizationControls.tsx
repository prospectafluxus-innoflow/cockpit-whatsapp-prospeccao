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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  departmentName,
  departmentParentOptions,
  feedbackMembershipFingerprint,
  feedbackRoleReach,
  canConfirmFeedbackMembership,
  hydrateFeedbackMembership,
  isMembershipFormCurrent,
  scopeLabel,
} from "@/lib/feedbackOrganization";
import { refreshAfterMutation, returnedRecordName } from "@/lib/feedbackScope";
import { FEEDBACK_ROLE_LABELS, type FeedbackRole } from "@shared/feedback";
import {
  Check,
  ChevronDown,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type OrganizationPerson = FeedbackWorkspace["people"][number] & {
  membershipRole?: FeedbackRole | null;
  feedbackCanRead?: boolean;
  hasFeedbackAccess?: boolean;
};
type OrganizationDepartment = FeedbackWorkspace["departments"][number];
type OrganizationWorkspace = Omit<
  FeedbackWorkspace,
  "people" | "departments"
> & {
  people: OrganizationPerson[];
  departments: OrganizationDepartment[];
};

type OrganizationProps = {
  workspace: OrganizationWorkspace;
  onRefresh: () => void | Promise<unknown>;
  initialAccessUserId?: number;
  queryBusy?: boolean;
};

export default function FeedbackOrganizationControls({
  workspace,
  onRefresh,
  initialAccessUserId,
  queryBusy = false,
}: OrganizationProps) {
  if (!workspace.companyId) return null;
  return (
    <div className="space-y-6">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Permissões explícitas</AlertTitle>
        <AlertDescription>
          Papéis, escopos e direito de leitura são registros independentes. O
          papel da conta não concede leitura automaticamente; o servidor
          revalida empresa, papel e escopo antes de salvar.
        </AlertDescription>
      </Alert>
      <div className="grid gap-6 xl:grid-cols-2">
        <DepartmentManager workspace={workspace} onRefresh={onRefresh} />
        {workspace.membership?.role === "company_admin" ? (
          <MembershipManager
            workspace={workspace}
            onRefresh={onRefresh}
            initialUserId={initialAccessUserId}
            queryBusy={queryBusy}
          />
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
      <AlertTitle>Papéis e permissões definidos pelo administrador</AlertTitle>
      <AlertDescription>
        Somente o administrador da empresa define papel e leitura de conteúdo.
        RH pode continuar organizando departamentos, atribuições e escopos.
      </AlertDescription>
    </Alert>
  );
}

function DepartmentManager({
  workspace,
  onRefresh,
}: {
  workspace: OrganizationWorkspace;
  onRefresh: () => void | Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("none");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingParentId, setEditingParentId] = useState("none");
  const [showArchived, setShowArchived] = useState(false);
  const [archiveRequest, setArchiveRequest] = useState<{
    id: number;
    name: string;
    confirmation: string;
  } | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const create = feedbackApi.createDepartment.useMutation();
  const update = feedbackApi.updateDepartment.useMutation();
  const visibleDepartments = workspace.departments.filter(
    department => showArchived || department.active
  );
  const parentOptions = departmentParentOptions(workspace.departments);
  const editingParentOptions = departmentParentOptions(
    workspace.departments,
    editingId
  );

  const saveDepartment = async (input: {
    id?: number;
    name: string;
    parentId: number | null;
    active: boolean;
  }) => {
    setOperationError(null);
    try {
      const result = input.id
        ? await update.mutateAsync({
            id: input.id,
            name: input.name,
            parentId: input.parentId,
            active: input.active,
          })
        : await create.mutateAsync({
            companyId: workspace.companyId!,
            name: input.name,
            parentId: input.parentId,
          });
      const refreshed = await refreshAfterMutation(onRefresh);
      const departmentName = returnedRecordName(
        result.department,
        "Departamento"
      );
      toast.success(
        refreshed
          ? `Departamento “${departmentName}” ${input.id ? "atualizado" : "criado"}.`
          : `Departamento “${departmentName}” gravado; não foi possível atualizar a lista.`
      );
      if (!refreshed)
        setOperationError(
          `Departamento “${departmentName}” gravado; atualize a página antes de repetir.`
        );
      return refreshed;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o departamento.";
      setOperationError(message);
      toast.error(message);
      return false;
    }
  };

  const submitCreate = async () => {
    if (!name.trim()) return;
    const saved = await saveDepartment({
      name: name.trim(),
      parentId: parentId === "none" ? null : Number(parentId),
      active: true,
    });
    if (saved) {
      setName("");
      setParentId("none");
    }
  };

  const submitUpdate = async () => {
    if (editingId === null || !editingName.trim()) return;
    const department = workspace.departments.find(
      item => item.id === editingId
    );
    if (!department) return;
    const saved = await saveDepartment({
      id: editingId,
      name: editingName.trim(),
      parentId: editingParentId === "none" ? null : Number(editingParentId),
      active: department.active,
    });
    if (saved) setEditingId(null);
  };

  const archive = async () => {
    if (
      !archiveRequest ||
      archiveRequest.confirmation.trim() !== archiveRequest.name
    )
      return;
    const department = workspace.departments.find(
      item => item.id === archiveRequest.id
    );
    if (!department) return;
    const saved = await saveDepartment({
      id: department.id,
      name: department.name,
      parentId: department.parentId,
      active: false,
    });
    if (saved) setArchiveRequest(null);
  };

  const restore = async (department: OrganizationDepartment) => {
    await saveDepartment({
      id: department.id,
      name: department.name,
      parentId: department.parentId,
      active: true,
    });
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings2 className="h-5 w-5 text-primary" /> Departamentos
        </CardTitle>
        <CardDescription>
          Edite nome e pai por nome. Arquivar é reversível, não remove histórico
          e depende de o servidor confirmar que não há vínculos ou escopos
          ativos. Alterar a hierarquia pode alterar as áreas cobertas por
          gestores com autorização para incluir subdepartamentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {operationError ? (
          <Alert variant="destructive">
            <AlertTitle>Status da operação</AlertTitle>
            <AlertDescription>{operationError}</AlertDescription>
          </Alert>
        ) : null}
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
                {parentOptions.map(item => (
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
            disabled={create.isPending || update.isPending || !name.trim()}
          >
            <Plus className="h-4 w-4" /> Criar
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          Mostrar arquivados
        </label>
        <div className="space-y-2">
          {visibleDepartments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showArchived
                ? "Nenhum departamento cadastrado."
                : "Nenhum departamento ativo. Ative o filtro para consultar arquivados."}
            </p>
          ) : (
            visibleDepartments.map(department => (
              <div
                key={department.id}
                className="rounded-xl border border-border/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  {editingId === department.id ? (
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                      <Input
                        value={editingName}
                        onChange={event => setEditingName(event.target.value)}
                        aria-label={`Nome de ${department.name}`}
                      />
                      <Select
                        value={editingParentId}
                        onValueChange={setEditingParentId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sem departamento-pai" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            Sem departamento-pai
                          </SelectItem>
                          {editingParentOptions.map(item => (
                            <SelectItem key={item.id} value={String(item.id)}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{department.name}</p>
                        <Badge
                          variant={department.active ? "default" : "secondary"}
                        >
                          {department.active ? "Ativo" : "Arquivado"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {department.parentId
                          ? `Subdepartamento de ${departmentName(
                              workspace.departments,
                              department.parentId,
                              "Departamento arquivado"
                            )}`
                          : "Raiz"}
                      </p>
                    </div>
                  )}
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {editingId === department.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => void submitUpdate()}
                          disabled={update.isPending || !editingName.trim()}
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
                    ) : department.active ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(department.id);
                            setEditingName(department.name);
                            setEditingParentId(
                              department.parentId === null
                                ? "none"
                                : String(department.parentId)
                            );
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setArchiveRequest({
                              id: department.id,
                              name: department.name,
                              confirmation: "",
                            })
                          }
                        >
                          Arquivar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void restore(department)}
                        disabled={update.isPending}
                      >
                        Restaurar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
      <Dialog
        open={archiveRequest !== null}
        onOpenChange={open => {
          if (!open && !update.isPending) setArchiveRequest(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar departamento?</DialogTitle>
            <DialogDescription>
              O histórico será preservado. O servidor bloqueará o arquivamento
              se houver filhos, vínculos ou escopos vigentes.
            </DialogDescription>
          </DialogHeader>
          {archiveRequest ? (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 text-sm">
                <p>
                  Departamento: <strong>{archiveRequest.name}</strong>
                </p>
                <p>
                  Empresa:{" "}
                  <strong>{workspace.companyName ?? "Empresa atual"}</strong>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="archive-confirmation">
                  Digite o nome do departamento para confirmar
                </Label>
                <Input
                  id="archive-confirmation"
                  value={archiveRequest.confirmation}
                  onChange={event =>
                    setArchiveRequest(current =>
                      current
                        ? { ...current, confirmation: event.target.value }
                        : current
                    )
                  }
                  placeholder={archiveRequest.name}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={() => setArchiveRequest(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={
                update.isPending ||
                !archiveRequest ||
                archiveRequest.confirmation.trim() !== archiveRequest.name
              }
              onClick={() => void archive()}
            >
              {update.isPending ? "Arquivando…" : "Confirmar arquivamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MembershipManager({
  workspace,
  onRefresh,
  initialUserId,
  queryBusy,
}: {
  workspace: OrganizationWorkspace;
  onRefresh: () => void | Promise<unknown>;
  initialUserId?: number;
  queryBusy: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<FeedbackRole>("collaborator");
  const [canRead, setCanRead] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    userId: number;
    fingerprint: string;
    membershipId: number | null;
  } | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const mutation = feedbackApi.setMembership.useMutation();
  const person = workspace.people.find(item => item.id === Number(userId));
  const saved = hydrateFeedbackMembership(person);
  const current = isMembershipFormCurrent({
    selectedUserId: userId ? Number(userId) : null,
    snapshotUserId: snapshot?.userId ?? null,
    snapshotFingerprint: snapshot?.fingerprint ?? null,
    person,
  });
  const scopes = workspace.scopes.filter(
    scope => scope.userId === Number(userId)
  );
  const personName = person?.name || "Pessoa selecionada";
  const scopeNames = scopes.map(scope =>
    scopeLabel(
      scope.includeDescendants,
      departmentName(workspace.departments, scope.departmentId)
    )
  );
  const draftReach = feedbackRoleReach(role, scopeNames);
  const canConfirm = canConfirmFeedbackMembership({
    current,
    queryBusy,
    companyId: workspace.companyId,
    membershipCompanyId: workspace.membership?.companyId ?? null,
    membershipRole: workspace.membership?.role ?? null,
  });

  const selectPerson = (nextUserId: string) => {
    const nextPerson = workspace.people.find(
      item => item.id === Number(nextUserId)
    );
    const nextSaved = hydrateFeedbackMembership(nextPerson);
    setUserId(nextUserId);
    setRole(nextSaved.role);
    setCanRead(nextSaved.canReadFeedback);
    setConfirmed(false);
    setSnapshot(
      nextPerson
        ? {
            userId: nextPerson.id,
            fingerprint: feedbackMembershipFingerprint(nextPerson),
            membershipId: nextPerson.membershipId ?? null,
          }
        : null
    );
    setOperationError(null);
  };

  useEffect(() => {
    if (initialUserId === undefined || userId || !workspace.people.length)
      return;
    const initial = workspace.people.find(
      person => person.id === initialUserId
    );
    if (initial) selectPerson(String(initial.id));
  }, [initialUserId, userId, workspace.people]);

  useEffect(() => {
    setConfirmed(false);
  }, [userId, role, canRead]);

  useEffect(() => {
    if (snapshot && !current) setConfirmed(false);
  }, [current, snapshot]);

  useEffect(() => {
    if (!canConfirm) setConfirmed(false);
  }, [canConfirm]);

  const submit = async () => {
    if (
      !workspace.companyId ||
      !person ||
      !confirmed ||
      !canConfirm ||
      mutation.isPending
    ) {
      setOperationError(
        "Os dados da pessoa mudaram ou a confirmação não foi concluída. Selecione a pessoa novamente e revise."
      );
      return;
    }
    setOperationError(null);
    try {
      await mutation.mutateAsync({
        companyId: workspace.companyId,
        userId: person.id,
        role,
        canReadFeedback: canRead,
        expectedMembershipId: snapshot!.membershipId,
      });
      const refreshed = await refreshAfterMutation(onRefresh);
      toast.success(
        refreshed
          ? `Papel e permissões de “${personName}” salvos.`
          : `Papel de “${personName}” gravado; não foi possível atualizar a lista.`
      );
      if (!refreshed)
        setOperationError(
          "A alteração foi gravada, mas a atualização falhou. Não repita sem recarregar os dados."
        );
      setConfirmed(false);
      setSnapshot(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o papel de acesso.";
      setOperationError(message);
      toast.error(message);
      setConfirmed(false);
      try {
        await onRefresh();
      } catch {
        /* O erro original permanece visível; não repetir a gravação. */
      }
    }
  };

  return (
    <Card className="border-border/60" id="papeis-feedback">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" /> Papéis e permissões
        </CardTitle>
        <CardDescription>
          Administrador configura o papel e a leitura. Colaborador vê próprias
          devolutivas; Gestor vê a equipe direta; Gestor de áreas atua somente
          nos departamentos explicitamente atribuídos; RH e Administrador podem
          ler a empresa inteira somente com leitura explícita.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {operationError ? (
          <Alert variant="destructive">
            <AlertTitle>Status do papel de acesso</AlertTitle>
            <AlertDescription>{operationError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Pessoa</Label>
            <Select value={userId} onValueChange={selectPerson}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma pessoa" />
              </SelectTrigger>
              <SelectContent>
                {workspace.people.map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name || "Pessoa sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Papel do módulo</Label>
            <Select
              value={role}
              onValueChange={value => {
                const nextRole = value as FeedbackRole;
                setRole(nextRole);
                if (nextRole === "collaborator") setCanRead(false);
              }}
              disabled={!userId}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FEEDBACK_ROLE_LABELS) as FeedbackRole[]).map(
                  item => (
                    <SelectItem key={item} value={item}>
                      {item === "supermanager"
                        ? "Gestor de áreas (Supergestor)"
                        : FEEDBACK_ROLE_LABELS[item]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {person ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-medium">Estado salvo para {personName}</p>
            <p className="mt-1 text-muted-foreground">
              {saved.hasFeedbackAccess
                ? `Papel: ${saved.role === "supermanager" ? "Gestor de áreas (Supergestor)" : FEEDBACK_ROLE_LABELS[saved.role]}`
                : "Sem papel Feedback ativo"}
              {" · "}
              Leitura organizacional:{" "}
              {saved.canReadFeedback ? "ativada" : "desativada"}
            </p>
            <p className="mt-1 text-muted-foreground">
              Alcance salvo: {feedbackRoleReach(saved.role, scopeNames)}
            </p>
          </div>
        ) : null}
        <label className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
          <Checkbox
            checked={canRead}
            onCheckedChange={value => setCanRead(value === true)}
            disabled={!userId || role === "collaborator"}
          />
          <span>
            <span className="block text-sm font-medium">
              Pode avaliar e ler no escopo do perfil
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              A autorização é explícita e independente do papel. Para RH e
              Administrador, ativar esta opção permite ler conteúdo da empresa
              inteira; para Gestor e Gestor de áreas, limita-se ao alcance do
              perfil. Colaborador permanece sem leitura organizacional.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <Checkbox
            checked={confirmed}
            onCheckedChange={value => setConfirmed(value === true)}
            disabled={!userId || !canConfirm || mutation.isPending}
          />
          <span className="text-sm leading-relaxed">
            Confirmo <strong>{personName}</strong>, empresa{" "}
            <strong>{workspace.companyName ?? "Empresa atual"}</strong>, papel{" "}
            <strong>
              {role === "supermanager"
                ? "Gestor de áreas (Supergestor)"
                : FEEDBACK_ROLE_LABELS[role]}
            </strong>
            , leitura <strong>{canRead ? "ATIVADA" : "DESATIVADA"}</strong> e
            alcance <strong>{draftReach}</strong>.
          </span>
        </label>
        {!current && userId ? (
          <p className="text-xs text-destructive">
            Dados de acesso indisponíveis ou alterados. Carregue o estado atual
            antes de confirmar.
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => selectPerson(userId)}
              disabled={queryBusy || mutation.isPending}
            >
              Carregar acesso atual
            </Button>
          </p>
        ) : null}
        <Button
          onClick={() => void submit()}
          disabled={mutation.isPending || !userId || !confirmed || !canConfirm}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          {mutation.isPending ? "Aplicando…" : "Salvar papel e permissões"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ScopeManager({
  workspace,
  onRefresh,
}: {
  workspace: OrganizationWorkspace;
  onRefresh: () => void | Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [active, setActive] = useState(true);
  const [operationError, setOperationError] = useState<string | null>(null);
  const mutation = feedbackApi.setManagementScope.useMutation();
  const personName = (id: number) =>
    workspace.people.find(person => person.id === id)?.name ||
    "Pessoa não encontrada";
  const submit = async () => {
    if (!workspace.companyId || !userId || !departmentId) return;
    setOperationError(null);
    try {
      const result = await mutation.mutateAsync({
        companyId: workspace.companyId,
        userId: Number(userId),
        departmentId: Number(departmentId),
        includeDescendants,
        active,
      });
      const refreshed = await refreshAfterMutation(onRefresh);
      toast.success(
        refreshed
          ? `Escopo de ${personName(Number(userId))} salvo.`
          : "Escopo gravado; não foi possível atualizar a lista."
      );
      if (!refreshed)
        setOperationError(
          "O escopo foi gravado, mas a atualização falhou. Não repita sem recarregar os dados."
        );
      if (result.scope) setOpen(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o escopo.";
      setOperationError(message);
      toast.error(message);
    }
  };
  const scopes = workspace.scopes;

  return (
    <Card className="border-border/60 xl:col-span-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-start justify-between gap-3 text-left">
              <span>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <SlidersHorizontal className="h-5 w-5 text-primary" /> Gestão
                  de áreas (escopos opcionais)
                </CardTitle>
                <CardDescription>
                  Use somente para Gestor de áreas (Supergestor). Cada
                  departamento é uma autorização explícita; descendentes são uma
                  opção separada.
                </CardDescription>
              </span>
              <ChevronDown
                className={`mt-1 h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {operationError ? (
              <Alert variant="destructive">
                <AlertTitle>Status do escopo</AlertTitle>
                <AlertDescription>{operationError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Gestor de áreas</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma pessoa" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspace.people.map(person => (
                      <SelectItem key={person.id} value={String(person.id)}>
                        {person.name || "Pessoa sem nome"}
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
                />
                Incluir descendentes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={active} onCheckedChange={setActive} /> Escopo
                ativo
              </label>
            </div>
            <Button
              onClick={() => void submit()}
              disabled={mutation.isPending || !userId || !departmentId}
              className="gap-2"
            >
              <Save className="h-4 w-4" /> Salvar escopo explícito
            </Button>
            <div className="space-y-2 border-t border-border/60 pt-4">
              {scopes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum escopo explícito cadastrado.
                </p>
              ) : (
                scopes.map(scope => (
                  <div
                    key={scope.id}
                    className="rounded-xl border border-border/60 p-3 text-sm"
                  >
                    <p className="font-medium">{personName(scope.userId)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {scopeLabel(
                        scope.includeDescendants,
                        departmentName(
                          workspace.departments,
                          scope.departmentId
                        )
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
