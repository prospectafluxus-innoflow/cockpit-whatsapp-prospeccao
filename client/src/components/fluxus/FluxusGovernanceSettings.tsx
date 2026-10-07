import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
type AdminChange = {
  person: Person;
  companyId: number;
  companyName: string;
  isAdmin: boolean;
  expectedIsAdmin: boolean;
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
  const feedback = trpc.feedback.workspace.useQuery(
    { companyId: company.id },
    { retry: false }
  );
  const designation = trpc.feedback.setCompanyAdministrator.useMutation();
  const organizationAccess = form.reportVisibility !== "participant_only";

  useEffect(() => {
    setAdminChange(null);
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

  const confirmAdministrator = async () => {
    if (!adminChange || !canConfirm) return;
    try {
      await designation.mutateAsync({
        companyId: adminChange.companyId,
        userId: adminChange.person.id,
        isAdmin: adminChange.isAdmin,
        expectedIsAdmin: adminChange.expectedIsAdmin,
      });
      toast.success(
        adminChange.isAdmin
          ? "Administrador da empresa definido."
          : "Administração da empresa removida. O colaborador mantém seu acesso pessoal ao Feedback."
      );
      setAdminChange(null);
      await Promise.all([
        utils.feedback.workspace.invalidate({ companyId: company.id }),
        utils.fluxus.adminCompany.invalidate({ companyId: company.id }),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o administrador."
      );
      setAdminChange(null);
      await feedback.refetch();
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
              Escolha o perfil Persona e marque, na mesma linha, quem será
              administrador da empresa no Feedback. A administração permite
              organizar competências, colaboradores e ciclos, sem liberar
              automaticamente a leitura de feedbacks.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              No Persona, gestor e RH recebem acesso ao dashboard agregado da
              própria empresa. Relatórios individuais continuam sujeitos à
              política, ao aceite explícito para a Beta 2 e à auditoria.
            </p>
            {feedback.error ? (
              <div
                role="alert"
                className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 p-3 text-sm"
              >
                Não foi possível carregar a opção de administrador. Os controles
                estão bloqueados até a consulta funcionar.
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
            <div className="mt-4 grid gap-2">
              {people.map(person => {
                const candidate = feedback.data?.people.find(
                  item => item.id === person.id
                );
                const known = Boolean(
                  feedback.data?.enabled &&
                    feedback.data.companyId === company.id &&
                    candidate &&
                    !feedback.error
                );
                const isAdmin = Boolean(candidate?.isCompanyAdmin);
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
                      <label
                        htmlFor={`company-admin-${person.id}`}
                        className="flex min-h-10 items-center gap-2 text-sm"
                        title={
                          !known
                            ? "A conta precisa estar ativa nesta empresa e a consulta do Feedback precisa carregar."
                            : undefined
                        }
                      >
                        <Checkbox
                          id={`company-admin-${person.id}`}
                          aria-label={`Administrador da empresa no Feedback: ${person.name || "colaborador sem nome"}`}
                          checked={known ? isAdmin : "indeterminate"}
                          disabled={
                            !known ||
                            feedback.isFetching ||
                            designation.isPending
                          }
                          onCheckedChange={value => {
                            if (!known || value === "indeterminate") return;
                            setAdminChange({
                              person,
                              companyId: company.id,
                              companyName: company.name,
                              isAdmin: value,
                              expectedIsAdmin: isAdmin,
                            });
                          }}
                        />
                        <span>
                          Administrador da empresa{" "}
                          <span className="text-xs text-muted-foreground">
                            (Feedback)
                          </span>
                        </span>
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
    </>
  );
}
