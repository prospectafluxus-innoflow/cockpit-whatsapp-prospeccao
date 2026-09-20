import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FluxusPersonaLogo } from "@/components/fluxus/FluxusBrand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function FluxusRegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    companyName: "",
    companyCode: "",
    jobTitle: "",
    department: "",
    password: "",
    confirmation: "",
  });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registered, setRegistered] = useState<{
    name: string;
    companyName: string;
  } | null>(null);

  const register = trpc.fluxus.registerCollaborator.useMutation({
    onSuccess: data =>
      setRegistered({
        name: data.name ?? "Colaborador",
        companyName: data.companyName,
      }),
    onError: error =>
      toast.error(error.message || "Não foi possível criar a conta."),
  });

  const update = (field: keyof typeof form, value: string) =>
    setForm(current => ({ ...current, [field]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      Object.entries(form).some(
        ([key, value]) => key !== "department" && !value.trim()
      )
    )
      return toast.error("Preencha todos os campos obrigatórios.");
    if (form.password !== form.confirmation)
      return toast.error("As senhas não coincidem.");
    if (form.password.length < 8)
      return toast.error("A senha deve ter ao menos 8 caracteres.");
    if (!privacyAccepted)
      return toast.error(
        "Confirme a ciência sobre a finalidade e o tratamento dos dados."
      );
    register.mutate({
      name: form.name,
      email: form.email,
      companyName: form.companyName,
      companyCode: form.companyCode,
      jobTitle: form.jobTitle,
      department: form.department || undefined,
      password: form.password,
      privacyAccepted: true,
    });
  };

  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07110f] p-5 text-white">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.05] p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold">
            Conta criada com segurança
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Olá, <strong className="text-white">{registered.name}</strong>. Seu
            acesso foi vinculado à empresa{" "}
            <strong className="text-white">{registered.companyName}</strong> e
            sua avaliação já está disponível.
          </p>
          <Link href="/fluxus/login">
            <Button className="mt-7 h-11 w-full rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
              Entrar e iniciar avaliação
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07110f] px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/fluxus/login"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao login
          </Link>
          <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-300" /> Dados
            vinculados pelo código da empresa
          </span>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
                  Fluxus Persona
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                  Cadastro do colaborador
                </h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Use o nome e o código da empresa exatamente como foram
                  enviados pela InnoFlow.
                </p>
              </div>
              <FluxusPersonaLogo className="h-auto w-full max-w-[250px] object-contain" />
            </div>
          </div>

          <form onSubmit={submit} className="p-6 sm:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Nome completo" htmlFor="name">
                <Input
                  id="name"
                  value={form.name}
                  onChange={event => update("name", event.target.value)}
                  autoComplete="name"
                  placeholder="Seu nome"
                  disabled={register.isPending}
                  className="h-11 rounded-xl border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="E-mail profissional" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={event => update("email", event.target.value)}
                  autoComplete="email"
                  placeholder="voce@empresa.com.br"
                  disabled={register.isPending}
                  className="h-11 rounded-xl border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="Empresa" htmlFor="company">
                <Input
                  id="company"
                  value={form.companyName}
                  onChange={event => update("companyName", event.target.value)}
                  placeholder="Nome da empresa"
                  disabled={register.isPending}
                  className="h-11 rounded-xl border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="Código da empresa" htmlFor="company-code">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    id="company-code"
                    value={form.companyCode}
                    onChange={event =>
                      update("companyCode", event.target.value)
                    }
                    placeholder="Código recebido"
                    disabled={register.isPending}
                    className="h-11 rounded-xl border-white/10 bg-black/20 pl-10 text-white"
                  />
                </div>
              </Field>
              <Field label="Cargo / função" htmlFor="job">
                <Input
                  id="job"
                  value={form.jobTitle}
                  onChange={event => update("jobTitle", event.target.value)}
                  placeholder="Ex.: Analista de Operações"
                  disabled={register.isPending}
                  className="h-11 rounded-xl border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field
                label="Área / departamento (opcional)"
                htmlFor="department"
              >
                <Input
                  id="department"
                  value={form.department}
                  onChange={event => update("department", event.target.value)}
                  placeholder="Ex.: Comercial"
                  disabled={register.isPending}
                  className="h-11 rounded-xl border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="Senha" htmlFor="password">
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={event => update("password", event.target.value)}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    disabled={register.isPending}
                    className="h-11 rounded-xl border-white/10 bg-black/20 pr-10 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Field label="Confirmar senha" htmlFor="confirmation">
                <Input
                  id="confirmation"
                  type={showPassword ? "text" : "password"}
                  value={form.confirmation}
                  onChange={event => update("confirmation", event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  disabled={register.isPending}
                  className="h-11 rounded-xl border-white/10 bg-black/20 text-white"
                />
              </Field>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/15 p-4">
              <Checkbox
                id="privacy"
                checked={privacyAccepted}
                onCheckedChange={checked =>
                  setPrivacyAccepted(checked === true)
                }
                className="mt-0.5"
              />
              <Label
                htmlFor="privacy"
                className="cursor-pointer text-xs font-normal leading-relaxed text-zinc-400"
              >
                Li o aviso de privacidade 2026-09-01 e estou ciente de que as
                respostas serão tratadas para autoconhecimento, devolutiva e
                desenvolvimento profissional. Meu resultado ficará disponível
                para mim e poderá ser compartilhado conforme a política de
                visibilidade da empresa informada. A ferramenta não realiza
                diagnóstico, ranking ou decisão automática de contratação,
                promoção ou desligamento. Após o cadastro, poderei consultar a
                finalidade, retenção, consentimentos e exercer meus direitos na
                Central de Privacidade.
              </Label>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-500">
                Já possui acesso?{" "}
                <Link
                  href="/fluxus/login"
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  Entrar
                </Link>
              </p>
              <Button
                type="submit"
                disabled={register.isPending}
                className="h-11 rounded-xl bg-emerald-400 px-7 font-semibold text-emerald-950 hover:bg-emerald-300 active:scale-[0.98]"
              >
                {register.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
                  </>
                ) : (
                  "Criar conta e continuar"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm text-zinc-300">
        {label}
      </Label>
      {children}
    </div>
  );
}
