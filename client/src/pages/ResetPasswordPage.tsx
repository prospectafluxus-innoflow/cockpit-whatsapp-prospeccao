import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageSquare, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function ResetPasswordPage() {
  const [location] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  const resetMutation = trpc.authOwn.resetPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      toast.success("Senha redefinida com sucesso!");
    },
    onError: (err) => {
      toast.error(err.message || "Token inválido ou expirado.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { toast.error("Token inválido."); return; }
    if (newPassword.length < 6) { toast.error("A senha deve ter ao menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem."); return; }
    resetMutation.mutate({ token, newPassword });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <MessageSquare className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Nova senha</h1>
          <p className="text-sm text-zinc-500 mt-1">Defina uma nova senha para sua conta</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          {!done ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-medium">Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500 h-11 rounded-xl pr-11"
                    disabled={resetMutation.isPending}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-medium">Confirmar nova senha</Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500 h-11 rounded-xl"
                  disabled={resetMutation.isPending}
                />
              </div>

              <Button type="submit" disabled={resetMutation.isPending}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-all duration-150 active:scale-[0.97]">
                {resetMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Redefinindo...</>
                ) : "Redefinir senha"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">Senha redefinida!</p>
                <p className="text-zinc-400 text-sm mt-1">Sua senha foi alterada com sucesso.</p>
              </div>
              <Link href="/login">
                <Button className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl">
                  Ir para o login
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
