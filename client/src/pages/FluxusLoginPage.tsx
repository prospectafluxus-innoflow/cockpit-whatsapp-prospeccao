import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FluxusPersonaLogo } from "@/components/fluxus/FluxusBrand";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function FluxusLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const login = trpc.authOwn.login.useMutation({
    onSuccess: data => {
      if (data.accountType !== "fluxus") {
        toast.error("Use o acesso de colaborador vinculado à Fluxus Persona.");
        return;
      }
      toast.success("Bem-vindo(a) à Fluxus Persona.");
      window.location.href = "/fluxus";
    },
    onError: error =>
      toast.error(error.message || "E-mail ou senha incorretos."),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) return toast.error("Informe e-mail e senha.");
    login.mutate({ email, password });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07110f] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-16 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-[460px] w-[460px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Portal InnoFlow
        </Link>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Ambiente protegido
        </span>
      </header>

      <main className="relative z-10 grid min-h-[calc(100vh-80px)] place-items-center px-4 pb-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl lg:grid-cols-[1.05fr_.95fr]">
          <section className="hidden min-h-[610px] flex-col justify-between border-r border-white/10 bg-gradient-to-br from-emerald-400/10 via-transparent to-cyan-400/10 p-10 lg:flex">
            <div>
              <FluxusPersonaLogo className="h-auto w-full max-w-[330px] object-contain" />
              <p className="mt-12 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                Desenvolvimento comportamental
              </p>
              <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-tight">
                Compreenda seu estilo. Desenvolva escolhas melhores.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-zinc-400">
                Uma experiência de autoconhecimento que cruza tendências
                naturais com as exigências percebidas da função, sem rótulos
                definitivos.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-zinc-400">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <strong className="block text-white">Privado</strong> Acesso
                individual
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <strong className="block text-white">Versionado</strong> Método
                Beta 1.0
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <strong className="block text-white">Prático</strong> Foco em
                desenvolvimento
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-10 lg:p-12">
            <div className="mx-auto max-w-sm">
              <div className="mb-8 lg:hidden">
                <FluxusPersonaLogo className="h-auto w-full max-w-[280px] object-contain" />
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                Acesso do colaborador
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Entre com o e-mail e a senha cadastrados para responder ou
                consultar sua avaliação.
              </p>

              <form onSubmit={submit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fluxus-email" className="text-zinc-300">
                    E-mail
                  </Label>
                  <Input
                    id="fluxus-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="voce@empresa.com.br"
                    disabled={login.isPending}
                    className="h-12 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fluxus-password" className="text-zinc-300">
                      Senha
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="fluxus-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="••••••••"
                      disabled={login.isPending}
                      className="h-12 rounded-xl border-white/10 bg-black/20 pr-11 text-white placeholder:text-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={login.isPending}
                  className="h-12 w-full rounded-xl bg-emerald-400 font-semibold text-emerald-950 hover:bg-emerald-300 active:scale-[0.98]"
                >
                  {login.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Entrando...
                    </>
                  ) : (
                    "Entrar na Fluxus Persona"
                  )}
                </Button>
              </form>

              <p className="mt-7 text-center text-sm text-zinc-500">
                Primeiro acesso?{" "}
                <Link
                  href="/fluxus/cadastro"
                  className="font-medium text-emerald-300 hover:text-emerald-200"
                >
                  Criar conta de colaborador
                </Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
