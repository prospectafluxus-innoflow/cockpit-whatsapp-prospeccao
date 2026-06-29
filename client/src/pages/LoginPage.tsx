import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Clock, XCircle } from "lucide-react";
import { Link } from "wouter";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [blockStatus, setBlockStatus] = useState<"pending" | "rejected" | null>(null);

  const loginMutation = trpc.authOwn.login.useMutation({
    onSuccess: () => {
      toast.success("Login realizado com sucesso!");
      window.location.href = "/";
    },
    onError: (err) => {
      const msg = err.message || "";
      if (msg.startsWith("PENDING:")) {
        setBlockStatus("pending");
      } else if (msg.startsWith("REJECTED:")) {
        setBlockStatus("rejected");
      } else {
        setBlockStatus(null);
        toast.error(msg || "Email ou senha incorretos.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha email e senha.");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <img
            src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663667466619/jOvLxAxfEehmlwIV.png"
            alt="ProspectaFluxus"
            className="h-20 w-auto object-contain mx-auto mb-4"
          />
          <p className="text-sm text-zinc-500 mt-1">Acesse sua conta para continuar</p>
        </div>

        {/* Alerta de status bloqueado */}
        {blockStatus === "pending" && (
          <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">Cadastro aguardando aprovação</p>
              <p className="text-xs text-amber-400/80 mt-0.5">Seu acesso ainda não foi liberado. Aguarde o contato do administrador.</p>
            </div>
          </div>
        )}
        {blockStatus === "rejected" && (
          <div className="mb-4 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">Acesso negado</p>
              <p className="text-xs text-red-400/80 mt-0.5">Seu cadastro foi recusado. Entre em contato com o suporte.</p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300 text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-11 rounded-xl"
                autoComplete="email"
                disabled={loginMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300 text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-11 rounded-xl pr-11"
                  autoComplete="current-password"
                  disabled={loginMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                Esqueci minha senha
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-all duration-150 active:scale-[0.97]"
            >
              {loginMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Entrando...</>
              ) : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
            <p className="text-sm text-zinc-500">
              Não tem uma conta?{" "}
              <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          ProspectaFluxus © 2026
        </p>
      </div>
    </div>
  );
}
