import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { canConfirmCompanyAdministrator } from "@/lib/companyAdministrator";
import {
  hasHierarchySnapshot,
  managerCandidates,
  refreshAfterMutation,
  sameAssignmentSnapshot,
  type FeedbackHierarchyPerson,
} from "@/lib/feedbackScope";
import {
  administratorQueryRetryDelay,
  shouldRetryAdministratorQuery,
} from "@/lib/administratorQueryRecovery";
import { AlertTriangle, Loader2, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Company = {
  id: number;
  name: string;
  reportVisibility: string;
  beta2OrganizationAccessEnabled: boolean;
  minimumAggregateSize: number;
  retentionMonths: number;
  processingPurpose: string;
};
type Person = {
  id: number;
  name: string | null;
  email?: string | null;
  fluxusRole: "collaborator" | "manager" | "hr";
};
type DirectoryPerson = FeedbackHierarchyPerson & {
  isCompanyAdmin: boolean;
};
type DirectoryDepartment = { id: number; name: string; active: boolean };
type AdminChange = {
  person: Person;
  companyId: number;
  companyName: string;
  isAdmin: boolean;
  expectedIsAdmin: boolean;
};
type ManagerChange = {
  person: Person;
  companyId: number;
  companyName: string;
  previousManagerUserId: number | null;
  nextManagerUserId: number | null;
  expectedAssignmentId: number | null;
  departmentId: number | null;
  jobTitle: string | null;
};

export function FluxusGovernanceSettings({
  company,
  people,
}: {
  company: Company;
  people: Person[];
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    reportVisibility: company.reportVisibility as
      | "participant_only"
      | "participant_manager_hr"
      | "participant_hr",
    minimumAggregateSize: Math.max(5, company.minimumAggregateSize),
    retentionMonths: company.retentionMonths,
    processingPurpose: company.processingPurpose,
  });
  const [beta2AccessConfirmed, setBeta2AccessConfirmed] = useState(
    company.beta2OrganizationAccessEnabled
  );
  const [adminChange, setAdminChange] = useState<AdminChange | null>(null);
  const [managerChange, setManagerChange] = useState<ManagerChange | null>(
    null
  );
  const [adminError, setAdminError] = useState<string | null>(null);
  const [managerError, setManagerError] = useState<string | null>(null);
  const feedback = trpc.feedback.companyAdministratorDirectory.useQuery(
    { companyId: company.id },
    {
      retry: shouldRetryAdministratorQuery,
      retryDelay: administratorQueryRetryDelay,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    }
  );
  const designation = trpc.feedback.setCompanyAdministrator.useMutation();
  const assignment = trpc.feedback.assignEmployee.useMutation();
  const organizationAccess = form.reportVisibility !== "participant_only";

  useEffect(() => {
    setAdminChange(null);
    setManagerChange(null);
    setAdminError(null);
    setManagerError(null);
  }, [company.id]);

  const save = trpc.fluxus.updateCompanyGovernance.useMutation({
    onSuccess: async () => {
      toast.success("Política de governança atualizada.");
      await utils.fluxus.adminCompany.invalidate({ companyId: company.id });
    },
    onError: error => toast.error(error.message),
  });
  const role = trpc.fluxus.setCollaboratorRole.useMutation({
    onSuccess: async () => {
      toast.success("Papel de acesso atualizado.");
      await utils.fluxus.adminCompany.invalidate({ companyId: company.id });
      await utils.feedback.companyAdministratorDirectory.invalidate({
        companyId: company.id,
      });
    },
    onError: error => toast.error(error.message),
  });

  const canConfirm = canConfirmCompanyAdministrator({
    companyId: company.id,
    selection: adminChange,
    workspace: feedback.data,
    error: feedback.error,
    isFetching: feedback.isFetching,
    isPending: designation.isPending,
  });

  const directoryPeople =
    (feedback.data?.people as unknown as
      | readonly DirectoryPerson[]
      | undefined) ?? [];
  const directoryDepartments =
    (
      feedback.data as unknown as
        | { departments?: DirectoryDepartment[] }
        | undefined
    )?.departments ?? [];
  const directoryPersonById = new Map(
    people.map(person => [person.id, person])
  );
  const refreshRelevantQueries = async () => {
    await Promise.all([
      utils.feedback.companyAdministratorDirectory.invalidate({
        companyId: company.id,
      }),
      utils.feedback.workspace.invalidate({ companyId: company.id }),
      utils.fluxus.adminCompany.invalidate({ companyId: company.id }),
    ]);
    await feedback.refetch({ throwOnError: true });
  };
  const managerSnapshot = managerChange
    ? directoryPeople.find(person => person.id === managerChange.person.id)
    : undefined;
  const canConfirmManager = Boolean(
    managerChange &&
      managerChange.companyId === company.id &&
      feedback.data?.enabled &&
      feedback.data.companyId === company.id &&
      !feedback.error &&
      !feedback.isFetching &&
      !assignment.isPending &&
      sameAssignmentSnapshot(
        managerSnapshot,
        managerChange.expectedAssignmentId,
        managerChange.previousManagerUserId
      )
  );

  const confirmAdministrator = async () => {
    if (!adminChange || !canConfirm) return;
    setAdminError(null);
    try {
      await designation.mutateAsync({
        companyId: adminChange.companyId,
        userId: adminChange.person.id,
        isAdmin: adminChange.isAdmin,
        expectedIsAdmin: adminChange.expectedIsAdmin,
      });
      const refreshed = await refreshAfterMutation(refreshRelevantQueries);
      toast.success(
        refreshed
          ? adminChange.isAdmin
            ? "Administrador da empresa definido."
            : "Administração da empresa removida. O colaborador mantém seu acesso pessoal ao Feedback."
          : "Alteração de administrador gravada; não foi possível atualizar a lista."
      );
      setAdminChange(null);
      if (!refreshed)
        setAdminError(
          "Alteração de administrador gravada; não foi possível atualizar a lista. Tente atualizar a página antes de repetir."
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o administrador.";
      setAdminError(message);
      toast.error(message);
    }
  };

  const confirmManager = async () => {
    if (!managerChange || !managerSnapshot || !canConfirmManager) return;
    setManagerError(null);
    try {
      type AssignmentMutationInput = Parameters<
        typeof assignment.mutateAsync
      >[0] & {
        expectedAssignmentId?: number | null;
      };
      const input = {
        companyId: managerChange.companyId,
        userId: managerChange.person.id,
        departmentId: managerChange.departmentId,
        managerUserId: managerChange.nextManagerUserId,
        jobTitle: managerChange.jobTitle ?? undefined,
        expectedAssignmentId: managerChange.expectedAssignmentId,
      } satisfies AssignmentMutationInput;
      const result = await assignment.mutateAsync(input);
      const refreshed = await refreshAfterMutation(refreshRelevantQueries);
      const recordId = result.assignment?.id;
      toast.success(
        refreshed
          ? `Gestor direto de “${managerChange.person.name || "Pessoa"}” atualizado${recordId ? ` (registro #${recordId})` : ""}.`
          : `Gestor direto de “${managerChange.person.name || "Pessoa"}” gravado; não foi possível atualizar a lista.`
      );
      if (!refreshed)
        setManagerError(
          "Gestor direto gravado; não foi possível atualizar a lista. Tente atualizar a página antes de repetir."
        );
      setManagerChange(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o gestor direto.";
      setManagerError(message);
      toast.error(message);
    }
  };

  return (
    <>
      <Card className="border-emerald-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Governança, visibilidade e
            retenção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-2 block font-medium">
                Visibilidade individual
              </span>
              <select
                value={form.reportVisibility}
                onChange={event => {
                  const reportVisibility = event.target
                    .value as typeof form.reportVisibility;
                  setForm(current => ({ ...current, reportVisibility }));
                  if (reportVisibility === "participant_only")
                    setBeta2AccessConfirmed(false);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="participant_only">Somente participante</option>
                <option value="participant_manager_hr">
                  Participante, gestor e RH autorizados
                </option>
                <option value="participant_hr">
                  Participante e RH autorizado
                </option>
              </select>
            </label>
            <div>
              <Label htmlFor="aggregate-size">Mínimo para agregado</Label>
              <Input
                id="aggregate-size"
                type="number"
                min={5}
                max={25}
                value={form.minimumAggregateSize}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    minimumAggregateSize: Number(event.target.value),
                  }))
                }
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="retention">Retenção em meses</Label>
              <Input
                id="retention"
                type="number"
                min={6}
                max={120}
                value={form.retentionMonths}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    retentionMonths: Number(event.target.value),
                  }))
                }
                className="mt-2"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="purpose">Finalidade declarada</Label>
            <Textarea
              id="purpose"
              value={form.processingPurpose}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  processingPurpose: event.target.value,
                }))
              }
              className="mt-2"
            />
          </div>
          {organizationAccess ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">
                    Acesso a dados contextuais da Beta 2
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    O relatório de RH/gestor inclui momento atual, pressão,
                    recuperação e sinais autorrelatados de desgaste. Esses dados
                    não são diagnóstico nem avaliação de desempenho e só podem
                    ser usados para a finalidade declarada, devolutiva
                    responsável e ações de apoio.
                  </p>
                  <label className="mt-4 flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={beta2AccessConfirmed}
                      onChange={event =>
                        setBeta2AccessConfirmed(event.target.checked)
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      Confirmo a finalidade declarada e autorizo explicitamente
                      o acesso organizacional à versão RH/gestor da Beta 2,
                      sujeito à auditoria e à política selecionada.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ) : null}
          <Button
            onClick={() =>
              save.mutate({
                companyId: company.id,
                ...form,
                beta2OrganizationAccessConfirmed:
                  organizationAccess && beta2AccessConfirmed,
              })
            }
            disabled={
              save.isPending ||
              form.processingPurpose.trim().length < 20 ||
              (organizationAccess && !beta2AccessConfirmed)
            }
            className="gap-2"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            Salvar política
          </Button>

          <div
            id="papeis-de-acesso"
            className="scroll-mt-6 border-t border-border/60 pt-5"
          >
            <h3 className="font-semibold">Colaboradores e papéis de acesso</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Escolha o perfil Persona e selecione Sim ou Não em Administrador
              da empresa, na mesma linha. A alteração só é aplicada após sua
              confirmação. A administração do Feedback permite organizar
              competências, colaboradores e ciclos, sem liberar automaticamente
              a leitura de feedbacks.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              No Persona, gestores acessam somente a equipe vinculada a eles; RH
              mantém o escopo autorizado da empresa. Relatórios individuais
              continuam sujeitos à política, ao aceite explícito para a Beta 2 e
              à auditoria.
            </p>
            {feedback.error ? (
              <div
                role="alert"
                className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 p-3 text-sm"
              >
                Não foi possível carregar a opção de administrador. Os controles
                estão bloqueados até a consulta funcionar.
                <span className="text-xs">
                  {feedback.error.data?.code
                    ? `Código da consulta: ${feedback.error.data.code}.`
                    : "Falha de conexão com o serviço."}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void feedback.refetch()}
                  disabled={feedback.isFetching}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : feedback.isLoading ? (
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                Carregando os administradores atuais…
              </p>
            ) : !feedback.data?.enabled ? (
              <p className="mt-3 text-xs text-muted-foreground">
                O módulo Feedback está desabilitado; a opção de administrador
                não pode ser alterada.
              </p>
            ) : null}
            {adminError ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTitle>Status do administrador</AlertTitle>
                <AlertDescription>{adminError}</AlertDescription>
              </Alert>
            ) : null}
            {managerError ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTitle>Status do gestor direto</AlertTitle>
                <AlertDescription>{managerError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="mt-4 grid gap-2">
              {people.map(person => {
                const candidate = directoryPeople.find(
                  item => item.id === person.id
                );
                const known = Boolean(
                  feedback.data?.enabled &&
                    feedback.data.companyId === company.id &&
                    candidate &&
                    typeof candidate.isCompanyAdmin === "boolean" &&
                    !feedback.error
                );
                const isAdmin = Boolean(candidate?.isCompanyAdmin);
                const hierarchyKnown = Boolean(
                  feedback.data?.enabled &&
                    feedback.data.companyId === company.id &&
                    !feedback.error &&
                    hasHierarchySnapshot(candidate)
                );
                const departmentName = candidate?.departmentId
                  ? directoryDepartments.find(
                      department => department.id === candidate.departmentId
                    )?.name || `Departamento #${candidate.departmentId}`
                  : "Sem departamento";
                return (
                  <div
                    key={person.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-medium">
                      {person.name || "Sem nome"}
                    </span>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="space-y-1">
                        <span className="block text-xs text-muted-foreground">
                          Perfil Persona
                        </span>
                        <select
                          aria-label={`Perfil Persona de ${person.name || "colaborador"}`}
                          value={person.fluxusRole}
                          disabled={role.isPending}
                          onChange={event =>
                            role.mutate({
                              userId: person.id,
                              companyId: company.id,
                              fluxusRole: event.target
                                .value as Person["fluxusRole"],
                            })
                          }
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="collaborator">Colaborador</option>
                          <option value="manager">Gestor</option>
                          <option value="hr">RH</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block text-xs text-muted-foreground">
                          Gestor direto
                        </span>
                        <select
                          aria-label={`Gestor direto de ${person.name || "colaborador"}`}
                          value={
                            hierarchyKnown
                              ? candidate?.managerUserId === null
                                ? "none"
                                : String(candidate?.managerUserId)
                              : "unknown"
                          }
                          disabled={
                            !hierarchyKnown ||
                            feedback.isFetching ||
                            assignment.isPending
                          }
                          onChange={event => {
                            if (
                              !hierarchyKnown ||
                              !candidate ||
                              feedback.isFetching ||
                              assignment.isPending
                            )
                              return;
                            const value = event.target.value;
                            if (value === "unknown") return;
                            const nextManagerUserId =
                              value === "none" ? null : Number(value);
                            if (nextManagerUserId === candidate.managerUserId)
                              return;
                            setManagerError(null);
                            setManagerChange({
                              person,
                              companyId: company.id,
                              companyName: company.name,
                              previousManagerUserId: candidate.managerUserId,
                              nextManagerUserId,
                              expectedAssignmentId: candidate.assignmentId,
                              departmentId: candidate.departmentId,
                              jobTitle: candidate.jobTitle,
                            });
                          }}
                          className="h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground disabled:opacity-60"
                        >
                          {!hierarchyKnown ? (
                            <option value="unknown">
                              {feedback.isLoading
                                ? "Carregando…"
                                : "Indisponível"}
                            </option>
                          ) : null}
                          <option value="none">Sem gestor direto</option>
                          {managerCandidates(directoryPeople, person.id).map(
                            manager => (
                              <option
                                key={manager.id}
                                value={String(manager.id)}
                              >
                                {directoryPersonById.get(manager.id)?.name ||
                                  `Usuário #${manager.id}`}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                      <div className="min-w-44 text-xs text-muted-foreground">
                        <span className="block">
                          Departamento:{" "}
                          {hierarchyKnown ? departmentName : "Indisponível"}
                        </span>
                        <span className="block">
                          Cargo:{" "}
                          {hierarchyKnown
                            ? candidate?.jobTitle || "Não informado"
                            : "Indisponível"}
                        </span>
                      </div>
                      <label
                        htmlFor={`company-admin-${person.id}`}
                        className="space-y-1"
                        title={
                          !known
                            ? "A conta precisa estar ativa nesta empresa e a consulta do Feedback precisa carregar."
                            : undefined
                        }
                      >
                        <span className="block text-xs text-muted-foreground">
                          Administrador da empresa (Feedback)
                        </span>
                        <select
                          id={`company-admin-${person.id}`}
                          aria-label={`Administrador da empresa no Feedback: ${person.name || "colaborador sem nome"}`}
                          value={known ? (isAdmin ? "yes" : "no") : "unknown"}
                          disabled={
                            !known ||
                            feedback.isFetching ||
                            designation.isPending
                          }
                          onChange={event => {
                            if (
                              !known ||
                              feedback.isFetching ||
                              designation.isPending
                            )
                              return;
                            const value = event.target.value;
                            if (value !== "yes" && value !== "no") return;
                            const nextIsAdmin = value === "yes";
                            if (nextIsAdmin === isAdmin) return;
                            setAdminChange({
                              person,
                              companyId: company.id,
                              companyName: company.name,
                              isAdmin: nextIsAdmin,
                              expectedIsAdmin: isAdmin,
                            });
                          }}
                          className="h-9 min-w-28 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground disabled:opacity-60"
                        >
                          {!known ? (
                            <option value="unknown">
                              {feedback.isLoading
                                ? "Carregando…"
                                : "Indisponível"}
                            </option>
                          ) : null}
                          <option value="no">Não</option>
                          <option value="yes">Sim</option>
                        </select>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Depois de definido, o administrador entra com seu acesso de
              colaborador ao Fluxus Persona e abre “Feedback” para configurar o
              processo.
            </p>
          </div>
        </CardContent>
      </Card>
      <Dialog
        open={adminChange !== null}
        onOpenChange={open => {
          if (!open && !designation.isPending) setAdminChange(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adminChange?.isAdmin
                ? "Definir administrador da empresa"
                : "Remover administração da empresa"}
            </DialogTitle>
            <DialogDescription>
              Revise a pessoa, a empresa e os efeitos antes de confirmar a
              alteração de acesso.
            </DialogDescription>
          </DialogHeader>
          {adminChange ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="font-semibold">
                  {adminChange.person.name || "Colaborador sem nome"}
                </p>
                {adminChange.person.email ? (
                  <p className="text-muted-foreground">
                    {adminChange.person.email}
                  </p>
                ) : null}
                <p className="mt-2">
                  Empresa: <strong>{adminChange.companyName}</strong>
                </p>
              </div>
              <p>
                {adminChange.isAdmin
                  ? "A pessoa passará a administrar o Feedback desta empresa: configuração do processo, competências, organização, papéis e ciclos. O papel vigente no Feedback será substituído por administrador, sem leitura automática de notas ou evidências."
                  : "A pessoa deixará de administrar o Feedback desta empresa e passará ao papel de colaborador, sem leitura de feedbacks de terceiros. Eventual permissão de leitura organizacional também será removida."}
              </p>
              <p className="text-muted-foreground">
                O perfil Persona (Colaborador, Gestor ou RH) não será alterado.
                Os feedbacks e o histórico serão preservados.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={designation.isPending}
              onClick={() => setAdminChange(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={!canConfirm}
              onClick={() => void confirmAdministrator()}
            >
              {designation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {adminChange?.isAdmin
                ? "Confirmar administrador"
                : "Confirmar remoção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={managerChange !== null}
        onOpenChange={open => {
          if (!open && !assignment.isPending) setManagerChange(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar gestor direto</DialogTitle>
            <DialogDescription>
              Esta alteração atualiza o vínculo histórico usado pela fase 1 e
              pela fase 2. Ela não concede papel nem leitura de Feedback.
            </DialogDescription>
          </DialogHeader>
          {managerChange ? (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p>
                Pessoa:{" "}
                <strong>{managerChange.person.name || "Sem nome"}</strong>
              </p>
              <p>
                Gestor direto:{" "}
                <strong>
                  {managerChange.nextManagerUserId
                    ? directoryPersonById.get(managerChange.nextManagerUserId)
                        ?.name || `Usuário #${managerChange.nextManagerUserId}`
                    : "Sem gestor direto"}
                </strong>
              </p>
              <p>
                Empresa: <strong>{managerChange.companyName}</strong>
              </p>
              <p>
                Departamento atual preservado:{" "}
                <strong>
                  {managerChange.departmentId
                    ? directoryDepartments.find(
                        department =>
                          department.id === managerChange.departmentId
                      )?.name || `Departamento #${managerChange.departmentId}`
                    : "Sem departamento"}
                </strong>
              </p>
              <p>
                Cargo atual preservado:{" "}
                <strong>{managerChange.jobTitle || "Não informado"}</strong>
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={assignment.isPending}
              onClick={() => setManagerChange(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={!canConfirmManager}
              onClick={() => void confirmManager()}
            >
              {assignment.isPending ? "Salvando…" : "Confirmar e salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
