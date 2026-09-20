import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  getFluxusCompletionForVersion,
  getFluxusItemsForVersion,
  getFluxusSectionMetaForVersion,
  getFluxusSectionsForVersion,
  isFluxusV2Version,
} from "@shared/fluxusVersioning";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function FluxusAssessmentPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const topRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, error } = trpc.fluxus.me.useQuery();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const instrumentVersion = data?.assessment.instrumentVersion;
  const sections = useMemo(
    () => getFluxusSectionsForVersion(instrumentVersion),
    [instrumentVersion]
  );

  useEffect(() => {
    if (data && !hydrated) {
      setAnswers(data.assessment.answers ?? {});
      const firstIncomplete = sections.findIndex(section =>
        getFluxusItemsForVersion(
          data.assessment.instrumentVersion,
          section
        ).some(
          item => data.assessment.answers?.[item.id] === undefined
        )
      );
      setStep(firstIncomplete >= 0 ? firstIncomplete : 0);
      setHydrated(true);
    }
  }, [data, hydrated]);

  const currentSection = sections[step]!;
  const meta = getFluxusSectionMetaForVersion(
    instrumentVersion,
    currentSection
  );
  const items = useMemo(
    () => getFluxusItemsForVersion(instrumentVersion, currentSection),
    [instrumentVersion, currentSection]
  );
  const completion = useMemo(
    () => getFluxusCompletionForVersion(instrumentVersion, answers),
    [instrumentVersion, answers]
  );
  const sectionComplete = items.every(item => answers[item.id] !== undefined);

  const save = trpc.fluxus.saveDraft.useMutation({
    onSuccess: () => toast.success("Rascunho salvo."),
    onError: mutationError =>
      toast.error(mutationError.message || "Não foi possível salvar."),
  });
  const complete = trpc.fluxus.complete.useMutation({
    onSuccess: async () => {
      toast.success("Avaliação concluída. Seu relatório está pronto.");
      await utils.fluxus.me.invalidate();
      navigate("/fluxus");
    },
    onError: mutationError =>
      toast.error(mutationError.message || "Não foi possível concluir."),
  });

  if (isLoading || !hydrated) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-[520px] rounded-3xl" />
      </div>
    );
  }
  if (error || !data)
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error?.message || "Avaliação indisponível."}
        </AlertDescription>
      </Alert>
    );
  if (data.assessment.status === "completed") {
    navigate("/fluxus");
    return null;
  }

  const persist = async () => {
    await save.mutateAsync({ assessmentId: data.assessment.id, answers });
  };

  const next = async () => {
    if (!sectionComplete)
      return toast.error(
        "Responda todas as afirmações desta etapa antes de avançar."
      );
    try {
      await persist();
      if (step < sections.length - 1) {
        setStep(current => current + 1);
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch {
      // O mutation já apresenta a mensagem.
    }
  };

  const previous = () => {
    setStep(current => Math.max(0, current - 1));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const finish = async () => {
    if (completion.completed !== completion.total) {
      const missingSection = sections.findIndex(section =>
        getFluxusItemsForVersion(instrumentVersion, section).some(
          item => answers[item.id] === undefined
        )
      );
      if (missingSection >= 0) setStep(missingSection);
      return toast.error(
        `Ainda faltam ${completion.total - completion.completed} respostas.`
      );
    }
    complete.mutate({ assessmentId: data.assessment.id, answers });
  };

  return (
    <div ref={topRef} className="mx-auto max-w-5xl scroll-mt-24">
      <section className="mb-6 rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              Etapa {step + 1} de {sections.length}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {meta.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {meta.description}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              save.mutate({ assessmentId: data.assessment.id, answers })
            }
            disabled={save.isPending}
            className="gap-2 self-start rounded-xl"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            Salvar e sair depois
          </Button>
        </div>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Progresso geral · {completion.total - completion.completed}{" "}
              resposta(s) pendente(s)
            </span>
            <strong className="text-foreground">
              {completion.percentage}%
            </strong>
          </div>
          <Progress value={completion.percentage} className="h-2" />
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {sections.map((section, index) => {
            const done = getFluxusItemsForVersion(
              instrumentVersion,
              section
            ).every(
              item => answers[item.id] !== undefined
            );
            const sectionLabel = getFluxusSectionMetaForVersion(
              instrumentVersion,
              section
            ).title
              .replace(/^Bloco\s+\d+[AB]?\s*·\s*/i, "")
              .replace(/^Etapa\s+\d+\s*·\s*/i, "");
            return (
              <button
                key={section}
                onClick={() => setStep(index)}
                className={`flex h-9 items-center justify-center rounded-xl border text-xs font-medium transition-colors ${index === step ? "border-primary bg-primary text-primary-foreground" : done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border/60 bg-muted/30 text-muted-foreground"}`}
              >
                {done ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                <span className="hidden sm:inline">{sectionLabel}</span>
                <span className="sm:hidden">{index + 1}</span>
              </button>
            );
          })}
        </div>
      </section>

      {isFluxusV2Version(instrumentVersion) &&
      data.assessment.prefilledFromAssessmentId ? (
        <Alert className="mb-6 border-emerald-500/30 bg-emerald-500/5">
          <Check className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="leading-relaxed">
            Reaproveitamos suas 20 respostas de perfil comportamental e 8
            respostas sobre a função do ciclo anterior. Revise essas etapas se
            algo mudou. As 33 respostas de Momento Atual e Índice Fluxus são
            novas e devem refletir as últimas quatro semanas.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        {items.map((item, index) => (
          <Card
            key={item.id}
            className={`border-border/60 shadow-sm transition-colors ${answers[item.id] ? "bg-card" : "bg-card/70"}`}
          >
            <CardContent className="p-5 sm:p-6">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-sm font-medium leading-relaxed sm:text-base">
                  {item.prompt}
                </p>
              </div>
              <div className="mt-5">
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map(value => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${item.prompt}: ${value}`}
                      aria-pressed={answers[item.id] === value}
                      onClick={() =>
                        setAnswers(current => ({
                          ...current,
                          [item.id]: value,
                        }))
                      }
                      className={`h-10 rounded-xl border text-sm font-semibold transition-all active:scale-95 sm:h-11 ${answers[item.id] === value ? "border-primary bg-primary text-primary-foreground shadow-sm" : value === 4 ? "border-border bg-muted/60 text-foreground hover:border-primary/50" : "border-border/60 bg-background hover:border-primary/50 hover:bg-primary/5"}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground sm:text-xs">
                  <span>{meta.lowLabel}</span>
                  <span>Intermediário</span>
                  <span>{meta.highLabel}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-3 z-20 mt-6 flex items-center justify-between rounded-2xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur print:hidden">
        <Button
          variant="ghost"
          onClick={step === 0 ? () => navigate("/fluxus") : previous}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Sair" : "Voltar"}
        </Button>
        <div className="hidden text-xs text-muted-foreground sm:block">
          {items.filter(item => answers[item.id] !== undefined).length} de{" "}
          {items.length} nesta etapa
        </div>
        {step < sections.length - 1 ? (
          <Button
            onClick={next}
            disabled={save.isPending}
            className="gap-2 rounded-xl"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}{" "}
            Próxima etapa <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={finish}
            disabled={complete.isPending}
            className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500"
          >
            {complete.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}{" "}
            Concluir avaliação
          </Button>
        )}
      </div>
    </div>
  );
}
