import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Loader2, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Company = {
  id: number;
  reportVisibility: string;
  beta2OrganizationAccessEnabled: boolean;
  minimumAggregateSize: number;
  retentionMonths: number;
  processingPurpose: string;
};
type Person = {
  id: number;
  name: string | null;
  fluxusRole: "collaborator" | "manager" | "hr";
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
  const organizationAccess = form.reportVisibility !== "participant_only";
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

  return <Card className="border-emerald-500/30"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Governança, visibilidade e retenção</CardTitle></CardHeader><CardContent className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3"><label className="text-sm"><span className="mb-2 block font-medium">Visibilidade individual</span><select value={form.reportVisibility} onChange={event => { const reportVisibility = event.target.value as typeof form.reportVisibility; setForm(current => ({ ...current, reportVisibility })); if (reportVisibility === "participant_only") setBeta2AccessConfirmed(false); }} className="h-10 w-full rounded-md border border-input bg-background px-3"><option value="participant_only">Somente participante</option><option value="participant_manager_hr">Participante, gestor e RH autorizados</option><option value="participant_hr">Participante e RH autorizado</option></select></label><div><Label htmlFor="aggregate-size">Mínimo para agregado</Label><Input id="aggregate-size" type="number" min={5} max={25} value={form.minimumAggregateSize} onChange={event => setForm(current => ({ ...current, minimumAggregateSize: Number(event.target.value) }))} className="mt-2" /></div><div><Label htmlFor="retention">Retenção em meses</Label><Input id="retention" type="number" min={6} max={120} value={form.retentionMonths} onChange={event => setForm(current => ({ ...current, retentionMonths: Number(event.target.value) }))} className="mt-2" /></div></div>
    <div><Label htmlFor="purpose">Finalidade declarada</Label><Textarea id="purpose" value={form.processingPurpose} onChange={event => setForm(current => ({ ...current, processingPurpose: event.target.value }))} className="mt-2" /></div>
    {organizationAccess ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><div><p className="font-semibold">Acesso a dados contextuais da Beta 2</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">O relatório de RH/gestor inclui momento atual, pressão, recuperação e sinais autorrelatados de desgaste. Esses dados não são diagnóstico nem avaliação de desempenho e só podem ser usados para a finalidade declarada, devolutiva responsável e ações de apoio.</p><label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={beta2AccessConfirmed} onChange={event => setBeta2AccessConfirmed(event.target.checked)} className="mt-1 h-4 w-4" /><span>Confirmo a finalidade declarada e autorizo explicitamente o acesso organizacional à versão RH/gestor da Beta 2, sujeito à auditoria e à política selecionada.</span></label></div></div></div> : null}
    <Button onClick={() => save.mutate({ companyId: company.id, ...form, beta2OrganizationAccessConfirmed: organizationAccess && beta2AccessConfirmed })} disabled={save.isPending || form.processingPurpose.trim().length < 20 || (organizationAccess && !beta2AccessConfirmed)} className="gap-2">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar política</Button>
    <div className="border-t border-border/60 pt-5"><h3 className="font-semibold">Papéis de acesso</h3><p className="mt-1 text-xs text-muted-foreground">Gestor e RH recebem acesso ao dashboard agregado da própria empresa. Relatórios individuais dependem da política, do aceite explícito para a Beta 2 e de auditoria.</p><div className="mt-4 grid gap-2">{people.map(person => <div key={person.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-4 py-3"><span className="text-sm font-medium">{person.name || "Sem nome"}</span><select value={person.fluxusRole} onChange={event => role.mutate({ userId: person.id, companyId: company.id, fluxusRole: event.target.value as Person["fluxusRole"] })} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="collaborator">Colaborador</option><option value="manager">Gestor</option><option value="hr">RH</option></select></div>)}</div></div>
  </CardContent></Card>;
}
