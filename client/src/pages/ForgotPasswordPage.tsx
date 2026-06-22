import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageSquare, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const forgotMutation = trpc.authOwn.forgotPassword.useMutation({
    onSuccess: (data) => {
      setSent(true);
      if (data.resetToken) setResetToken(data.resetToken);
    },
    onError: () => {
      toast.error("Erro ao processar solicitação. Tente novamente.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Informe seu email."); return; }
    forgotMutation.mutate({ email });
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
          <h1 className="text-2xl font-semibold text-white tracking-tight">Recuperar senha</h1>
          <p className="text-sm text-zinc-500 mt-1">Informe seu email para receber o link de redefinição</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300 text-sm font-medium">Email cadastrado</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500 h-11 rounded-xl"
                  disabled={forgotMutation.isPending}
                />
              </div>

              <Button
                type="submit"
                disabled={forgotMutation.isPending}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-all duration-150 active:scale-[0.97]"
              >
                {forgotMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</>
                ) : "Solicitar redefinição"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">Solicitação recebida!</p>
                <p className="text-zinc-400 text-sm mt-1">
                  Se o email <span className="text-zinc-200">{email}</span> estiver cadastrado, você receberá as instruções em breve.
                </p>
              </div>
              {resetToken && (
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-left">
                  <p className="text-xs text-zinc-400 mb-2">Token de redefinição (use em /reset-password):</p>
                  <p className="text-xs font-mono text-emerald-400 break-all">{resetToken}</p>
                  <Link href={`/reset-password?token=${resetToken}`}>
                    <Button size="sm" className="mt-3 bg-emerald-500 hover:bg-emerald-400 text-black text-xs rounded-lg">
                      Redefinir senha agora
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
