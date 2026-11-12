import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  BookOpenCheck,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { FluxusExecutiveDocument } from "@/components/fluxus/FluxusExecutiveDocument";
import type { ExecutivePreviewResponse } from "@shared/fluxusExecutive";

export default function FluxusOwnReportPage() {
  const [, navigate] = useLocation();
  const query = trpc.fluxusExecutive.myReport.useQuery(undefined, {
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [freshPrint, setFreshPrint] = useState<ExecutivePreviewResponse | null>(
    null
  );
  const mounted = useRef(true);
  const printingLock = useRef(false);
  const response = freshPrint ?? query.data;
  const blocked = Boolean(query.error || printError);
  const ready = Boolean(response && !blocked);

  useEffect(() => {
    if (ready) document.body.dataset.personaExecutiveReport = "true";
    else delete document.body.dataset.personaExecutiveReport;
    return () => {
      delete document.body.dataset.personaExecutiveReport;
    };
  }, [ready]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      document.body.classList.remove("persona-executive-print-revalidated");
    };
  }, []);

  const refresh = () => {
    if (printingLock.current) return;
    setPrintError(null);
    setFreshPrint(null);
    void query.refetch();
  };

  const print = async () => {
    if (!ready || printingLock.current || query.isFetching) return;
    printingLock.current = true;
    setPrinting(true);
    let oldTitle: string | undefined;
    try {
      // The server derives the owner from the session again; no target IDs are sent.
      const result = await query.refetch({ throwOnError: true });
      if (!mounted.current) return;
      if (!result.data || result.error)
        throw new Error("Não foi possível atualizar seu relatório.");
      flushSync(() => {
        setFreshPrint(result.data);
        setPrintError(null);
      });
      oldTitle = document.title;
      document.title = `Meu relatório integrado · ${result.data.data.people[0]?.name || "Fluxus Persona"}`;
      document.body.classList.add("persona-executive-print-revalidated");
      window.print();
    } catch (error) {
      if (mounted.current) {
        setFreshPrint(null);
        setPrintError(
          error instanceof Error
            ? error.message
            : "Não foi possível conferir o acesso atual. Tente novamente."
        );
      }
    } finally {
      document.body.classList.remove("persona-executive-print-revalidated");
      if (oldTitle !== undefined) document.title = oldTitle;
      printingLock.current = false;
      if (mounted.current) {
        setPrinting(false);
        setFreshPrint(null);
      }
    }
  };

  return (
    <div className="persona-executive-page persona-own-report-page">
      <header className="persona-executive-header print:hidden">
        <div>
          <p className="persona-executive-kicker">
            Meu resultado · acesso pessoal
          </p>
          <h1>Meu relatório integrado</h1>
        </div>
        <button
          type="button"
          className="persona-executive-button persona-executive-button--subtle"
          disabled={printing}
          onClick={() => navigate("/fluxus")}
        >
          <ArrowLeft size={16} /> Voltar ao início
        </button>
      </header>
      <section
        className="persona-executive-toolbar print:hidden"
        aria-label="Ações do relatório pessoal"
      >
        <div>
          <p>
            Seu perfil e orientações já vêm organizados abaixo. Não é necessário
            selecionar pessoas nem preencher notas da consultoria.
          </p>
          <p>
            QP e Sabotadores próprios entram após a confirmação, quando
            vinculados a este ciclo. Esta página não compartilha seus resultados
            com ninguém.
          </p>
        </div>
        <div className="persona-executive-toolbar-actions">
          <button
            type="button"
            className="persona-executive-button persona-executive-button--primary"
            disabled={!ready || printing || query.isFetching}
            onClick={print}
          >
            {printing ? (
              <Loader2 size={16} className="persona-executive-spin" />
            ) : (
              <Printer size={16} />
            )}{" "}
            {printing ? "Conferindo acesso…" : "Imprimir / PDF"}
          </button>
          <button
            type="button"
            className="persona-executive-button persona-executive-button--secondary"
            disabled={printing || query.isFetching}
            onClick={refresh}
          >
            <RefreshCw size={16} /> Atualizar relatório
          </button>
          <button
            type="button"
            className="persona-executive-button persona-executive-button--subtle"
            disabled={printing}
            onClick={() => navigate("/fluxus/complementares")}
          >
            <BookOpenCheck size={16} /> Conferir meus PDFs
          </button>
        </div>
      </section>
      {query.isLoading ? (
        <div
          className="persona-executive-empty-state print:hidden"
          role="status"
        >
          <Loader2 className="persona-executive-spin" size={28} />
          <h2>Preparando seu relatório…</h2>
        </div>
      ) : blocked ? (
        <div
          className="persona-executive-empty-state print:hidden"
          role="alert"
        >
          <h2>Não foi possível abrir seu relatório agora</h2>
          <p>{printError ?? query.error?.message}</p>
          <button
            type="button"
            className="persona-executive-button persona-executive-button--primary"
            disabled={query.isFetching || printing}
            onClick={refresh}
          >
            Tentar novamente
          </button>
        </div>
      ) : response ? (
        <div className="persona-executive-document-shell">
          <FluxusExecutiveDocument
            data={response.data}
            notes={response.notes}
            focusIndividual
          />
        </div>
      ) : (
        <div className="persona-executive-empty-state print:hidden">
          <h2>Seu relatório ainda não está disponível</h2>
          <p>
            Conclua uma avaliação Persona Beta 2 para abrir sua ficha integrada.
          </p>
        </div>
      )}
    </div>
  );
}
