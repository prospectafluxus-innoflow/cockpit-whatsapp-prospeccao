import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, Home, LogOut, UserRound } from "lucide-react";
import { useLocation } from "wouter";

export function FluxusLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="mx-auto h-16 max-w-6xl rounded-2xl" />
        <Skeleton className="mx-auto mt-6 h-[520px] max-w-6xl rounded-3xl" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/fluxus/login";
    return null;
  }

  if (user.accountType !== "fluxus") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-3xl border border-border/60 bg-card p-8 text-center shadow-xl">
          <UserRound className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">
            Conta não vinculada à Fluxus Persona
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Esta conta pertence ao módulo de prospecção. Use o acesso de
            colaborador recebido da InnoFlow.
          </p>
          <Button className="mt-6" onClick={() => setLocation("/")}>
            Voltar ao ProspectaFluxus
          </Button>
        </div>
      </div>
    );
  }

  const navigation = [
    { path: "/fluxus", label: "Início", icon: Home },
    { path: "/fluxus/avaliacao", label: "Avaliação", icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7f8] text-slate-950 dark:bg-[#09100f] dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#09100f]/90 print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => setLocation("/fluxus")}
            className="flex items-center gap-3 text-left"
          >
            <img
              src="/icons/icon-master.png"
              alt="InnoFlow"
              className="h-10 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-tight">
                Fluxus Persona
              </p>
              <p className="text-[11px] text-muted-foreground">
                Desenvolvimento comportamental
              </p>
            </div>
          </button>

          <nav className="flex items-center gap-1">
            {navigation.map(item => {
              const active = location === item.path;
              return (
                <Button
                  key={item.path}
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setLocation(item.path)}
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-2 text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9">
        {children}
      </main>
    </div>
  );
}
