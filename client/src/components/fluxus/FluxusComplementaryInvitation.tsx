import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";

/**
 * Convite opcional: a checagem de disponibilidade é deliberadamente feita só
 * quando este card é montado, isto é, depois da conclusão do Persona.
 */
export default function FluxusComplementaryInvitation() {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const availability = trpc.fluxusComplementary.availability.useQuery(
    undefined,
    {
      retry: false,
    }
  );

  if (
    dismissed ||
    availability.isLoading ||
    availability.error ||
    !availability.data?.enabled ||
    !availability.data.eligible
  ) {
    return null;
  }

  return (
    <Card className="mb-6 border-orange-500/30 bg-card shadow-sm">
      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-700 dark:text-orange-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Etapa opcional
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Complementar meu autoconhecimento
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Se você já tem um relatório de Inteligência Positiva, pode
              importá-lo para organizar uma conversa de desenvolvimento. A
              participação não altera nem bloqueia seu Persona ou Feedback.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
          <button
            type="button"
            onClick={() => navigate("/fluxus/complementares")}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ver opção <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex h-9 items-center justify-center rounded-md px-4 text-sm text-muted-foreground underline-offset-4 hover:bg-muted hover:underline"
          >
            Agora não
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export { FluxusComplementaryInvitation };
