import { FluxusExecutiveDocument } from "@/components/fluxus/FluxusExecutiveDocument";
import { FluxusPersonaLogo } from "@/components/fluxus/FluxusBrand";
import { trpc } from "@/lib/trpc";
import { revalidateExecutiveExport } from "@/lib/fluxusExecutiveExport";
import { flushSync } from "react-dom";
import {
  EXECUTIVE_MAX_PEOPLE,
  emptyExecutiveNotes,
  executiveNotesSchema,
  type ExecutiveDirectoryEntry,
  type ExecutiveNotes,
  type ExecutivePreviewResponse,
  type ExecutiveSavedReport,
  type ExecutiveSelection,
} from "@shared/fluxusExecutive";
import {
  ArrowLeft,
  FilePlus2,
  Loader2,
  Printer,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export type FluxusExecutivePageProps = {
  params?: { id: string };
};

type NoteKey =
  | "title"
  | "audience"
  | "author"
  | "summary"
  | "context"
  | "actions";
type IndividualNoteKey = "summary" | "context" | "recommendations";

const emptyNotes = () => emptyExecutiveNotes();

function positiveInteger(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function sameSelection(
  left: ExecutiveSelection | null,
  right: ExecutiveSelection | null
) {
  if (
    !left ||
    !right ||
    left.mode !== right.mode ||
    (left.companyId !== undefined &&
      right.companyId !== undefined &&
      left.companyId !== right.companyId)
  )
    return false;
  if (left.assessmentIds.length !== right.assessmentIds.length) return false;
  return left.assessmentIds.every(
    (id, index) => id === right.assessmentIds[index]
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(parsed);
}

function errorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

export function buildExecutiveSavePayload(
  selection: ExecutiveSelection,
  notes: ExecutiveNotes,
  reportId?: number,
  expectedRevision?: number
) {
  return {
    selection,
    notes,
    ...(reportId === undefined ? {} : { reportId }),
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
  };
}

function SelectionCard({
  people,
  selectedIds,
  mode,
  canEdit,
  isLoading,
  truncated,
  onModeChange,
  onToggle,
  onMarkAll,
  onClear,
}: {
  people: ExecutiveDirectoryEntry[];
  selectedIds: number[];
  mode: ExecutiveSelection["mode"];
  canEdit: boolean;
  isLoading: boolean;
  truncated: boolean;
  onModeChange: (mode: ExecutiveSelection["mode"]) => void;
  onToggle: (assessmentId: number, checked: boolean) => void;
  onMarkAll: () => void;
  onClear: () => void;
}) {
  return (
    <section
      className="persona-executive-section persona-executive-selection"
      aria-labelledby="persona-executive-selection-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">1 · Seleção</p>
        <h2 id="persona-executive-selection-title">
          Escolha as avaliações concluídas
        </h2>
        <p>
          Uma avaliação por pessoa. A seleção é validada novamente pelo servidor
          ao gerar a prévia.
        </p>
      </div>
      <label className="persona-executive-field">
        <span>Tipo de visão</span>
        <select
          className="persona-executive-select"
          value={mode}
          disabled={!canEdit}
          onChange={event =>
            onModeChange(event.target.value as ExecutiveSelection["mode"])
          }
        >
          <option value="individual">Individual</option>
          <option value="team">Equipe</option>
        </select>
      </label>
      <div className="persona-executive-selection-toolbar">
        <strong>{selectedIds.length} selecionada(s)</strong>
        <div className="persona-executive-inline-actions">
          <button
            type="button"
            className="persona-executive-button persona-executive-button--subtle"
            disabled={!canEdit || !people.length}
            onClick={onMarkAll}
          >
            Marcar todos (até {EXECUTIVE_MAX_PEOPLE})
          </button>
          <button
            type="button"
            className="persona-executive-button persona-executive-button--subtle"
            disabled={!canEdit || !selectedIds.length}
            onClick={onClear}
          >
            Limpar
          </button>
        </div>
      </div>
      {truncated ? (
        <p className="persona-executive-helper">
          A lista foi limitada a {EXECUTIVE_MAX_PEOPLE} avaliações. Nenhuma
          pessoa fora deste recorte é marcada automaticamente.
        </p>
      ) : null}
      <div className="persona-executive-directory" aria-live="polite">
        {isLoading ? (
          <div className="persona-executive-loading">
            <Loader2 className="persona-executive-spin" size={18} /> Carregando
            avaliações autorizadas…
          </div>
        ) : people.length ? (
          people.map(person => {
            const checked = selectedIds.includes(person.assessmentId);
            return (
              <label
                className={`persona-executive-directory-row${checked ? " persona-executive-directory-row--selected" : ""}`}
                key={person.assessmentId}
              >
                <input
                  className="persona-executive-checkbox"
                  type="checkbox"
                  checked={checked}
                  disabled={!canEdit}
                  onChange={event =>
                    onToggle(person.assessmentId, event.target.checked)
                  }
                />
                <span className="persona-executive-directory-person">
                  <strong>{person.name || "Participante"}</strong>
                  <span>
                    {person.jobTitle || "Cargo não informado"} ·{" "}
                    {person.department || "Departamento não informado"}
                  </span>
                  <small>
                    {person.cycleLabel || `Ciclo ${person.cycleNumber}`} ·{" "}
                    {formatDate(person.completedAt)}
                  </small>
                </span>
              </label>
            );
          })
        ) : (
          <p className="persona-executive-empty">
            Nenhuma avaliação concluída e autorizada para este acesso.
          </p>
        )}
      </div>
    </section>
  );
}

function NoteField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="persona-executive-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          className="persona-executive-textarea"
          rows={rows}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="persona-executive-input"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function NotesEditor({
  mode,
  people,
  notes,
  canEdit,
  onChange,
}: {
  mode: ExecutiveSelection["mode"];
  people: ExecutiveDirectoryEntry[];
  notes: ExecutiveNotes;
  canEdit: boolean;
  onChange: (patch: Partial<ExecutiveNotes>) => void;
}) {
  const [openPeople, setOpenPeople] = useState<Set<number>>(
    () =>
      new Set(
        mode === "individual" && people[0] ? [people[0].assessmentId] : []
      )
  );
  const updatePerson = (
    assessmentId: number,
    key: IndividualNoteKey,
    value: string
  ) => {
    onChange({
      individuals: {
        ...notes.individuals,
        [String(assessmentId)]: {
          summary: notes.individuals[String(assessmentId)]?.summary || "",
          context: notes.individuals[String(assessmentId)]?.context || "",
          recommendations:
            notes.individuals[String(assessmentId)]?.recommendations || "",
          [key]: value,
        },
      },
    });
  };
  return (
    <section
      className="persona-executive-section persona-executive-notes-editor"
      aria-labelledby="persona-executive-notes-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">2 · Complementos</p>
        <h2 id="persona-executive-notes-title">Notas da consultoria</h2>
        <p>
          São opcionais e ficam separadas dos resultados calculados. Salve
          explicitamente quando terminar.
        </p>
      </div>
      <div className="persona-executive-form-grid">
        <NoteField
          label="Título"
          value={notes.title}
          onChange={value => onChange({ title: value })}
        />
        <NoteField
          label="Público"
          value={notes.audience}
          onChange={value => onChange({ audience: value })}
        />
        <NoteField
          label="Autor(a)"
          value={notes.author}
          onChange={value => onChange({ author: value })}
        />
      </div>
      {mode === "team" ? (
        <div className="persona-executive-form-stack">
          <NoteField
            label="Síntese do relatório (opcional)"
            value={notes.summary}
            onChange={value => onChange({ summary: value })}
            multiline
            rows={6}
            placeholder="Registre a leitura da consultoria sem substituir a evidência autorrelatada."
          />
          <NoteField
            label="Contexto (opcional)"
            value={notes.context}
            onChange={value => onChange({ context: value })}
            multiline
            rows={5}
            placeholder="Contexto informado na conversa, sem copiar dados de outro cliente."
          />
          <NoteField
            label="Plano de ações, responsáveis e prazos (opcional)"
            value={notes.actions}
            onChange={value => onChange({ actions: value })}
            multiline
            rows={6}
            placeholder="Ações combinadas, responsáveis e datas de revisão."
          />
        </div>
      ) : null}
      <div className="persona-executive-person-notes">
        <h3>Complementos por pessoa (opcionais)</h3>
        <p className="persona-executive-helper">
          Abra somente a ficha que deseja complementar; os campos não são
          obrigatórios.
        </p>
        {people.map(person => {
          const assessmentNotes = notes.individuals[
            String(person.assessmentId)
          ] || { summary: "", context: "", recommendations: "" };
          const open = openPeople.has(person.assessmentId);
          return (
            <details
              className="persona-executive-details"
              key={person.assessmentId}
              open={open}
              onToggle={event => {
                const next = new Set(openPeople);
                if (event.currentTarget.open) next.add(person.assessmentId);
                else next.delete(person.assessmentId);
                setOpenPeople(next);
              }}
            >
              <summary>
                {person.name || "Participante"} ·{" "}
                {person.jobTitle || "Cargo não informado"}
              </summary>
              {open ? (
                <div className="persona-executive-form-stack">
                  <NoteField
                    label="Síntese individual (opcional)"
                    value={assessmentNotes.summary}
                    onChange={value =>
                      updatePerson(person.assessmentId, "summary", value)
                    }
                    multiline
                    rows={4}
                  />
                  <NoteField
                    label="Contexto individual (opcional)"
                    value={assessmentNotes.context}
                    onChange={value =>
                      updatePerson(person.assessmentId, "context", value)
                    }
                    multiline
                    rows={4}
                  />
                  <NoteField
                    label="Recomendações individuais (opcional)"
                    value={assessmentNotes.recommendations}
                    onChange={value =>
                      updatePerson(
                        person.assessmentId,
                        "recommendations",
                        value
                      )
                    }
                    multiline
                    rows={4}
                  />
                </div>
              ) : null}
            </details>
          );
        })}
      </div>
      {!canEdit ? (
        <p className="persona-executive-readonly-note">
          Este relatório está em modo somente leitura. Os complementos não podem
          ser editados por este acesso.
        </p>
      ) : null}
    </section>
  );
}

function SavedReports({
  reports,
  disabled,
  onOpen,
}: {
  reports: Array<{
    id: number;
    mode: "individual" | "team";
    title: string;
    revision: number;
    updatedAt: string;
  }>;
  disabled: boolean;
  onOpen: (id: number) => void;
}) {
  return (
    <section
      className="persona-executive-section persona-executive-saved-list"
      aria-labelledby="persona-executive-saved-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">Relatórios salvos</p>
        <h2 id="persona-executive-saved-title">Reabrir uma versão</h2>
      </div>
      {reports.length ? (
        <div className="persona-executive-saved-items">
          {reports.map(report => (
            <button
              type="button"
              className="persona-executive-saved-item"
              key={report.id}
              disabled={disabled}
              onClick={() => onOpen(report.id)}
            >
              <span>
                <strong>
                  {report.title ||
                    (report.mode === "team"
                      ? "Relatório de equipe"
                      : "Ficha individual")}
                </strong>
                <small>
                  {report.mode === "team" ? "Equipe" : "Individual"} · revisão{" "}
                  {report.revision} · {formatDate(report.updatedAt)}
                </small>
              </span>
              <span aria-hidden="true">Abrir</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="persona-executive-empty">
          Nenhum relatório salvo neste recorte.
        </p>
      )}
    </section>
  );
}

function AccessNotice({ message }: { message: string }) {
  return (
    <div className="persona-executive-error print:hidden" role="alert">
      <ShieldAlert size={19} aria-hidden="true" />
      <div>
        <strong>Acesso ou dados indisponíveis</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

export default function FluxusExecutivePage({
  params,
}: FluxusExecutivePageProps) {
  const [, navigate] = useLocation();
  const routeCompanyId = params?.id ? positiveInteger(params.id) : undefined;
  const queryParams = useMemo(() => {
    if (typeof window === "undefined")
      return { assessmentId: undefined, reportId: undefined };
    return {
      assessmentId: positiveInteger(
        new URLSearchParams(window.location.search).get("assessmentId")
      ),
      reportId: positiveInteger(
        new URLSearchParams(window.location.search).get("reportId")
      ),
    };
  }, []);
  const [mode, setMode] = useState<ExecutiveSelection["mode"]>(
    queryParams.assessmentId ? "individual" : "team"
  );
  const [selectedIds, setSelectedIds] = useState<number[]>(
    queryParams.assessmentId ? [queryParams.assessmentId] : []
  );
  const [submittedSelection, setSubmittedSelection] =
    useState<ExecutiveSelection | null>(null);
  const [preview, setPreview] = useState<ExecutivePreviewResponse | null>(null);
  const [notes, setNotes] = useState<ExecutiveNotes>(emptyNotes);
  const [snapshotNotes, setSnapshotNotes] =
    useState<ExecutiveNotes>(emptyNotes);
  const [savedReport, setSavedReport] = useState<ExecutiveSavedReport | null>(
    null
  );
  const [requestedReportId, setRequestedReportId] = useState<number | null>(
    queryParams.reportId ?? null
  );
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const initialisedFromUrl = useRef(false);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);
  const printingRef = useRef(false);
  const companyId = routeCompanyId;
  const canEdit = preview?.canEdit ?? true;
  const isDirty = JSON.stringify(notes) !== JSON.stringify(snapshotNotes);
  dirtyRef.current = isDirty;

  const directoryQuery = trpc.fluxusExecutive.directory.useQuery(
    { companyId },
    { retry: false }
  );
  const savedListQuery = trpc.fluxusExecutive.list.useQuery(
    { companyId },
    { retry: false }
  );
  const getQuery = trpc.fluxusExecutive.get.useQuery(
    { reportId: requestedReportId ?? 0 },
    { enabled: requestedReportId !== null, retry: false }
  );
  const previewQuery = trpc.fluxusExecutive.preview.useQuery(
    submittedSelection || { companyId, mode, assessmentIds: [] },
    {
      enabled: submittedSelection !== null && requestedReportId === null,
      retry: false,
    }
  );
  const utils = trpc.useUtils();

  const people = directoryQuery.data?.people ?? [];
  const directoryById = useMemo(
    () => new Map(people.map(person => [person.assessmentId, person])),
    [people]
  );
  const previewMatchesSelection = sameSelection(submittedSelection, {
    companyId,
    mode,
    assessmentIds: selectedIds,
  });
  const selectionValid =
    selectedIds.length > 0 &&
    selectedIds.length <= EXECUTIVE_MAX_PEOPLE &&
    (mode === "team" || selectedIds.length === 1);
  const previewReadable = Boolean(
    preview?.data && !previewQuery.error && !getQuery.error
  );
  const reportReady = previewReadable && previewMatchesSelection;
  const reports = savedListQuery.data ?? [];

  const discardNotes = () => {
    const next = emptyNotes();
    setNotes(next);
    setSnapshotNotes(next);
  };

  const confirmDiscard = (message: string) => {
    if (!isDirty) return true;
    if (typeof window === "undefined") return false;
    const accepted = window.confirm(message);
    if (accepted) discardNotes();
    return accepted;
  };

  useEffect(() => {
    if (
      !directoryQuery.data ||
      initialisedFromUrl.current ||
      queryParams.reportId
    )
      return;
    if (queryParams.assessmentId) {
      if (!directoryById.has(queryParams.assessmentId)) {
        toast.error(
          "A avaliação indicada não está disponível para este acesso."
        );
        initialisedFromUrl.current = true;
        return;
      }
      const selection: ExecutiveSelection = {
        companyId,
        mode: "individual",
        assessmentIds: [queryParams.assessmentId],
      };
      setMode("individual");
      setSelectedIds([queryParams.assessmentId]);
      setSubmittedSelection(selection);
    }
    initialisedFromUrl.current = true;
  }, [
    companyId,
    directoryById,
    directoryQuery.data,
    queryParams.assessmentId,
    queryParams.reportId,
  ]);

  useEffect(() => {
    const response = getQuery.data;
    if (!response?.report || dirtyRef.current) return;
    const key = `saved:${response.report.id}:${response.report.revision}`;
    if (hydratedKey === key) {
      // Consent and optional sources can change without a saved-report revision.
      setPreview(current =>
        current
          ? { ...current, data: response.data, canEdit: response.canEdit }
          : current
      );
      return;
    }
    setMode(response.report.mode);
    setSelectedIds(response.report.assessmentIds);
    setSubmittedSelection({
      companyId: response.report.companyId,
      mode: response.report.mode,
      assessmentIds: response.report.assessmentIds,
    });
    setSavedReport(response.report);
    setPreview(response);
    setNotes(response.notes);
    setSnapshotNotes(response.notes);
    setHydratedKey(key);
  }, [getQuery.data, hydratedKey]);

  useEffect(() => {
    const response = previewQuery.data;
    if (!response || dirtyRef.current || requestedReportId !== null) return;
    const key = `preview:${JSON.stringify(submittedSelection)}:${response.report?.id ?? "new"}:${response.report?.revision ?? 0}`;
    if (hydratedKey === key) {
      // Consent and optional sources can change without a saved-report revision.
      setPreview(current =>
        current
          ? { ...current, data: response.data, canEdit: response.canEdit }
          : current
      );
      return;
    }
    setPreview(response);
    setSavedReport(response.report);
    setNotes(response.notes || emptyNotes());
    setSnapshotNotes(response.notes || emptyNotes());
    setHydratedKey(key);
  }, [hydratedKey, previewQuery.data, submittedSelection, requestedReportId]);

  useEffect(() => {
    if (!previewQuery.error) return;
    setPreview(null);
    setSavedReport(null);
    setHydratedKey(null);
    toast.error(
      errorMessage(previewQuery.error, "Não foi possível gerar esta prévia.")
    );
  }, [previewQuery.error]);

  useEffect(() => {
    if (!getQuery.error) return;
    setPreview(null);
    setSavedReport(null);
    setHydratedKey(null);
    toast.error(
      errorMessage(getQuery.error, "Não foi possível reabrir este relatório.")
    );
  }, [getQuery.error]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (reportReady) document.body.dataset.personaExecutiveReport = "true";
    else delete document.body.dataset.personaExecutiveReport;
    return () => {
      delete document.body.dataset.personaExecutiveReport;
    };
  }, [reportReady]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      document.body.classList.remove("persona-executive-print-revalidated");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleToggle = (assessmentId: number, checked: boolean) => {
    if (!canEdit || isPrinting) return;
    if (mode === "individual") {
      setSelectedIds(checked ? [assessmentId] : []);
      return;
    }
    setSelectedIds(current => {
      if (checked)
        return current.includes(assessmentId) ||
          current.length >= EXECUTIVE_MAX_PEOPLE
          ? current
          : [...current, assessmentId];
      return current.filter(id => id !== assessmentId);
    });
  };

  const handleModeChange = (nextMode: ExecutiveSelection["mode"]) => {
    if (!canEdit || isPrinting) return;
    setMode(nextMode);
    if (nextMode === "individual" && selectedIds.length > 1)
      setSelectedIds(selectedIds.slice(0, 1));
  };

  const handleGenerate = () => {
    if (!selectionValid || !canEdit || controlsBusy) return;
    const nextSelection: ExecutiveSelection = {
      companyId,
      mode,
      assessmentIds: [...selectedIds],
    };
    const selectionChanged = !sameSelection(submittedSelection, nextSelection);
    if (
      selectionChanged &&
      !confirmDiscard(
        "Há complementos não salvos. Gerar outra prévia descartará essas alterações. Continuar?"
      )
    )
      return;
    if (selectionChanged) {
      setSavedReport(null);
      setRequestedReportId(null);
      setHydratedKey(null);
      if (!isDirty) discardNotes();
    }
    setSubmittedSelection(nextSelection);
  };

  const handleOpenSaved = (reportId: number) => {
    if (controlsBusy) return;
    if (
      !confirmDiscard(
        "Há complementos não salvos. Abrir este relatório descartará essas alterações. Continuar?"
      )
    )
      return;
    setPreview(null);
    setSubmittedSelection(null);
    setSavedReport(null);
    setHydratedKey(null);
    setRequestedReportId(reportId);
  };

  const handleNotesChange = (patch: Partial<ExecutiveNotes>) => {
    if (!canEdit || isPrinting) return;
    setNotes(current => ({ ...current, ...patch }));
  };

  const saveMutation = trpc.fluxusExecutive.save.useMutation({
    onMutate: variables => {
      const previous = preview;
      const normalizedNotes = executiveNotesSchema.parse(variables.notes);
      setPreview(current =>
        current ? { ...current, notes: normalizedNotes } : current
      );
      return { previous };
    },
    onSuccess: saved => {
      const normalizedNotes = executiveNotesSchema.parse(saved.notes);
      setSavedReport(saved);
      setRequestedReportId(saved.id);
      setSnapshotNotes(normalizedNotes);
      setNotes(normalizedNotes);
      setPreview(current =>
        current
          ? { ...current, notes: normalizedNotes, report: saved }
          : current
      );
      setHydratedKey(`saved:${saved.id}:${saved.revision}`);
      toast.success("Relatório salvo.");
      void utils.fluxusExecutive.list.invalidate({ companyId });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) setPreview(context.previous);
      toast.error(
        errorMessage(error, "Não foi possível salvar este relatório.")
      );
    },
  });

  const controlsBusy = saveMutation.isPending || isPrinting;

  const handleSave = () => {
    if (
      !preview?.data ||
      !submittedSelection ||
      !canEdit ||
      (!isDirty && Boolean(savedReport || preview.report)) ||
      !reportReady ||
      controlsBusy
    )
      return;
    saveMutation.mutate(
      buildExecutiveSavePayload(
        submittedSelection,
        notes,
        savedReport?.id ?? preview.report?.id,
        savedReport?.revision ?? preview.report?.revision
      )
    );
  };

  const handlePrint = async () => {
    if (
      !reportReady ||
      !submittedSelection ||
      isDirty ||
      controlsBusy ||
      printingRef.current ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    )
      return;
    printingRef.current = true;
    setIsPrinting(true);
    let previousTitle: string | undefined;
    let marked = false;
    try {
      const fresh = await revalidateExecutiveExport({
        selection: submittedSelection,
        reportId: savedReport?.id ?? preview?.report?.id,
        revision: savedReport?.revision ?? preview?.report?.revision,
        fetchSaved: reportId =>
          utils.fluxusExecutive.get.fetch({ reportId }, { staleTime: 0 }),
        fetchPreview: selection =>
          utils.fluxusExecutive.preview.fetch(selection, { staleTime: 0 }),
      });
      if (!mountedRef.current) return;
      flushSync(() => setPreview(fresh));
      previousTitle = document.title;
      document.title =
        notes.title.trim() || `Visão executiva · ${fresh.data.company.name}`;
      document.body.classList.add("persona-executive-print-revalidated");
      marked = true;
      window.print();
    } catch (error) {
      if (mountedRef.current) {
        setPreview(null);
        setHydratedKey(null);
        toast.error(
          errorMessage(
            error,
            "Não foi possível conferir o acesso atual. Reabra a prévia antes de imprimir."
          )
        );
      }
    } finally {
      if (marked)
        document.body.classList.remove("persona-executive-print-revalidated");
      if (previousTitle !== undefined) document.title = previousTitle;
      printingRef.current = false;
      if (mountedRef.current) setIsPrinting(false);
    }
  };

  const goBack = () => {
    if (controlsBusy) return;
    if (
      !confirmDiscard(
        "Há complementos não salvos. Sair desta visão descartará essas alterações. Continuar?"
      )
    )
      return;
    navigate(
      companyId ? `/fluxus/admin/empresa/${companyId}` : "/fluxus/equipe"
    );
  };

  const selectedPeople = selectedIds
    .map(id => directoryById.get(id))
    .filter(Boolean) as ExecutiveDirectoryEntry[];
  const visiblePeople = selectedPeople.length ? selectedPeople : people;

  return (
    <div className="persona-executive-page">
      <header className="persona-executive-header print:hidden">
        <div className="persona-executive-header-brand">
          <FluxusPersonaLogo className="persona-executive-logo" />
          <span>Visão executiva</span>
        </div>
        <button
          type="button"
          className="persona-executive-button persona-executive-button--subtle"
          onClick={goBack}
          disabled={controlsBusy}
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      </header>
      <div className="persona-executive-page-intro print:hidden">
        <div>
          <p className="persona-executive-kicker">Fluxus Persona · fase 1</p>
          <h1>Visão executiva · Perfil comportamental</h1>
          <p>
            Monte uma leitura individual ou de equipe a partir de avaliações
            Beta 2 concluídas. O sistema gera uma prévia pronta para conversa e
            PDF; não cria nem importa PowerPoint.
          </p>
          <p>
            QP e Sabotadores aparecem nas fichas quando os relatórios opcionais
            foram confirmados e compartilhados com você para este ciclo. Use
            Imprimir / PDF para conferir as autorizações atuais; Ctrl+P direto
            não exporta esses complementos. Cópias já exportadas não podem ser
            recolhidas automaticamente.
          </p>
        </div>
        <div className="persona-executive-intro-badge">
          <Sparkles size={18} />
          <span>
            Autorrelato exploratório
            <br />
            <strong>não é devolutiva EEC</strong>
          </span>
        </div>
      </div>
      {directoryQuery.error ? (
        <AccessNotice
          message={errorMessage(
            directoryQuery.error,
            "Não foi possível carregar as avaliações autorizadas."
          )}
        />
      ) : null}
      {getQuery.error ? (
        <AccessNotice
          message={errorMessage(
            getQuery.error,
            "O relatório solicitado não está disponível para este acesso."
          )}
        />
      ) : null}
      {previewQuery.error ? (
        <AccessNotice
          message={errorMessage(
            previewQuery.error,
            "A prévia foi rejeitada ou não pôde ser calculada."
          )}
        />
      ) : null}
      {preview?.canEdit === false ? (
        <AccessNotice message="Este relatório está disponível somente para leitura. Os controles de seleção, edição, salvamento e alteração ficam ocultos." />
      ) : null}
      <div className="persona-executive-layout">
        {canEdit ? (
          <aside className="persona-executive-sidebar print:hidden">
            <SelectionCard
              people={people}
              selectedIds={selectedIds}
              mode={mode}
              canEdit={canEdit && !controlsBusy}
              isLoading={directoryQuery.isLoading}
              truncated={Boolean(directoryQuery.data?.truncated)}
              onModeChange={handleModeChange}
              onToggle={handleToggle}
              onMarkAll={() =>
                setSelectedIds(
                  people
                    .slice(0, mode === "individual" ? 1 : EXECUTIVE_MAX_PEOPLE)
                    .map(person => person.assessmentId)
                )
              }
              onClear={() => setSelectedIds([])}
            />
            <fieldset disabled={controlsBusy} className="min-w-0 border-0 p-0">
              <NotesEditor
                mode={mode}
                people={visiblePeople}
                notes={notes}
                canEdit={canEdit}
                onChange={handleNotesChange}
              />
            </fieldset>
            <SavedReports
              reports={reports}
              disabled={isDirty || controlsBusy}
              onOpen={handleOpenSaved}
            />
          </aside>
        ) : null}
        <main className="persona-executive-main">
          {canEdit ? (
            <section
              className="persona-executive-toolbar print:hidden"
              aria-label="Ações da prévia"
            >
              <div>
                <p className="persona-executive-kicker">3 · Prévia</p>
                <h2>
                  {preview
                    ? previewMatchesSelection
                      ? "Prévia pronta para revisar"
                      : "Seleção alterada"
                    : "Gere uma prévia"}
                </h2>
                <p>
                  {previewMatchesSelection
                    ? "Revise os dados e, se desejar, acrescente notas consultivas."
                    : preview
                      ? "A prévia exibida corresponde à seleção anterior. Gere novamente para atualizar o documento."
                      : "Selecione ao menos uma avaliação para liberar o documento."}
                </p>
              </div>
              <div className="persona-executive-toolbar-actions">
                <button
                  type="button"
                  className="persona-executive-button persona-executive-button--primary"
                  disabled={
                    !selectionValid || previewQuery.isFetching || controlsBusy
                  }
                  onClick={handleGenerate}
                >
                  {previewQuery.isFetching ? (
                    <Loader2 className="persona-executive-spin" size={16} />
                  ) : (
                    <FilePlus2 size={16} />
                  )}{" "}
                  {preview
                    ? previewMatchesSelection
                      ? "Gerar / alterar prévia"
                      : "Gerar nova prévia"
                    : "Gerar prévia"}
                </button>
                <button
                  type="button"
                  className="persona-executive-button persona-executive-button--secondary"
                  disabled={
                    !reportReady ||
                    (!isDirty && Boolean(savedReport || preview?.report)) ||
                    controlsBusy
                  }
                  onClick={handleSave}
                >
                  <Save size={16} />{" "}
                  {saveMutation.isPending
                    ? "Salvando…"
                    : savedReport
                      ? "Atualizar relatório"
                      : "Salvar relatório"}
                </button>
                <button
                  type="button"
                  className="persona-executive-button persona-executive-button--subtle"
                  disabled={!reportReady || isDirty || controlsBusy}
                  onClick={handlePrint}
                >
                  <Printer size={16} />{" "}
                  {isPrinting ? "Conferindo acesso…" : "Imprimir / PDF"}
                </button>
              </div>
              {isDirty ? (
                <p className="persona-executive-dirty-warning" role="status">
                  Há complementos não salvos. Salve antes de imprimir ou abrir
                  outra versão.
                </p>
              ) : null}
            </section>
          ) : (
            <div className="persona-executive-toolbar persona-executive-toolbar--readonly print:hidden">
              <div>
                <p className="persona-executive-kicker">Somente leitura</p>
                <h2>Relatório executivo</h2>
                <p>
                  Os dados abaixo são a versão autorizada armazenada; não há
                  editor nesta sessão.
                </p>
              </div>
              <button
                type="button"
                className="persona-executive-button persona-executive-button--subtle"
                disabled={!reportReady}
                onClick={handlePrint}
              >
                <Printer size={16} />{" "}
                {isPrinting ? "Conferindo acesso…" : "Imprimir / PDF"}
              </button>
            </div>
          )}
          {previewReadable && preview ? (
            <div
              className={`persona-executive-document-shell${
                reportReady ? "" : " print:hidden"
              }`}
            >
              {!reportReady ? (
                <div className="persona-executive-stale-preview" role="status">
                  A prévia abaixo corresponde à seleção anterior e não pode ser
                  salva ou impressa. Gere uma nova prévia para emitir o recorte
                  atual.
                </div>
              ) : null}
              <FluxusExecutiveDocument data={preview.data} notes={notes} />
            </div>
          ) : (
            <div className="persona-executive-empty-state">
              <Sparkles size={28} />
              <h2>Nenhum documento em prévia</h2>
              <p>
                Escolha uma avaliação individual ou um recorte de equipe e
                clique em “Gerar prévia”. A exportação só fica disponível quando
                não há alterações não salvas.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
