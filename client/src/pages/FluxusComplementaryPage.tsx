import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  COMPLEMENTARY_TERMS_VERSION,
  COMPLEMENTARY_MAX_PDF_BYTES,
  CRITIC_LABELS,
  complementaryConsentText,
  emptyComplementaryValues,
  OFFICIAL_ASSESSMENT_URLS,
  SABOTEUR_LABELS,
  type ComplementaryDetail,
  type ComplementaryKind,
  type ComplementaryRecipient,
  type ComplementarySummary,
  type ComplementaryValues,
  type CriticKey,
  type SaboteurKey,
} from "@shared/fluxusComplementary";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  Check,
  ChevronDown,
  FileCheck2,
  FileUp,
  Loader2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PAGE_SIZE = 20;
const SABOTEUR_KEYS = Object.keys(SABOTEUR_LABELS) as SaboteurKey[];
const CRITIC_KEYS = Object.keys(CRITIC_LABELS) as CriticKey[];

export type DraftValues = {
  pq: string;
  saboteurs: Record<SaboteurKey, string>;
  critic: Record<CriticKey, string>;
};

type Tab = "mine" | "shared";
type DiscardTarget = number | "close" | null;

export function isValidComplementaryPdf(file: File | null): boolean {
  if (!file || file.size <= 0 || file.size > COMPLEMENTARY_MAX_PDF_BYTES) {
    return false;
  }
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function formatCalendarDate(value: string | null): string {
  if (!value) return "Não informada";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function isCompleteComplementaryDraft(
  draft: DraftValues,
  kind: ComplementaryKind
): boolean {
  if (kind === "pq") {
    const pq = Number(draft.pq);
    return (
      draft.pq.trim() !== "" && Number.isSafeInteger(pq) && pq >= 0 && pq <= 100
    );
  }
  const saboteursComplete = SABOTEUR_KEYS.every(key => {
    const value = Number(draft.saboteurs[key]);
    return (
      draft.saboteurs[key].trim() !== "" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 10
    );
  });
  const criticsValid = CRITIC_KEYS.every(
    key =>
      draft.critic[key].trim() === "" ||
      (Number.isSafeInteger(Number(draft.critic[key])) &&
        Number(draft.critic[key]) >= 1 &&
        Number(draft.critic[key]) <= 15)
  );
  return saboteursComplete && criticsValid;
}

function draftFromDetail(detail: ComplementaryDetail): DraftValues {
  const values = detail.values ?? emptyComplementaryValues();
  return {
    pq: values.pq == null ? "" : String(values.pq),
    saboteurs: Object.fromEntries(
      SABOTEUR_KEYS.map(key => [
        key,
        values.saboteurs[key] == null ? "" : String(values.saboteurs[key]),
      ])
    ) as Record<SaboteurKey, string>,
    critic: Object.fromEntries(
      CRITIC_KEYS.map(key => [
        key,
        values.critic[key] == null ? "" : String(values.critic[key]),
      ])
    ) as Record<CriticKey, string>,
  };
}

export function emptyDraft(): DraftValues {
  return {
    pq: "",
    saboteurs: Object.fromEntries(
      SABOTEUR_KEYS.map(key => [key, ""])
    ) as Record<SaboteurKey, string>,
    critic: Object.fromEntries(CRITIC_KEYS.map(key => [key, ""])) as Record<
      CriticKey,
      string
    >,
  };
}

type UploadPhase = "reading" | "sending" | null;

export type UploadFeedback = {
  tone: "error" | "status" | "success";
  message: string;
};

export function UploadFeedbackMessage({
  feedback,
}: {
  feedback: UploadFeedback | null;
}) {
  if (!feedback) return null;
  const isError = feedback.tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={`rounded-xl border p-3 text-sm leading-relaxed ${
        isError
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : feedback.tone === "success"
            ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
            : "border-primary/30 bg-primary/5 text-foreground"
      }`}
    >
      {feedback.message}
    </div>
  );
}

export function draftToValues(draft: DraftValues): ComplementaryValues {
  return {
    pq: draft.pq.trim() === "" ? null : Number(draft.pq),
    saboteurs: Object.fromEntries(
      SABOTEUR_KEYS.map(key => [
        key,
        draft.saboteurs[key].trim() === ""
          ? null
          : Number(draft.saboteurs[key]),
      ])
    ) as ComplementaryValues["saboteurs"],
    critic: Object.fromEntries(
      CRITIC_KEYS.map(key => [
        key,
        draft.critic[key].trim() === "" ? null : Number(draft.critic[key]),
      ])
    ) as ComplementaryValues["critic"],
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Não foi possível ler o PDF localmente."));
        return;
      }
      resolve(result.replace(/^data:[^,]*;base64,/, ""));
    };
    reader.onerror = () =>
      reject(new Error("Não foi possível ler o PDF localmente."));
    reader.readAsDataURL(file);
  });
}

export default function FluxusComplementaryPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("mine");
  const [mineOffset, setMineOffset] = useState(0);
  const [sharedOffset, setSharedOffset] = useState(0);
  const [mineReports, setMineReports] = useState<ComplementarySummary[]>([]);
  const [sharedReports, setSharedReports] = useState<ComplementarySummary[]>(
    []
  );
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<ComplementaryDetail | null>(null);
  const [draft, setDraft] = useState<DraftValues | null>(null);
  const [sourceDate, setSourceDate] = useState("");
  const [context, setContext] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget>(null);
  const [kind, setKind] = useState<ComplementaryKind>("pq");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [recipientUserIds, setRecipientUserIds] = useState<number[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(null);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadBusyRef = useRef(false);
  const conferenceRef = useRef<HTMLDivElement>(null);
  const focusConferenceAfterUploadRef = useRef(false);

  const availabilityQuery = trpc.fluxusComplementary.availability.useQuery(
    undefined,
    { retry: false }
  );
  const mineQuery = trpc.fluxusComplementary.mine.useQuery(
    { offset: mineOffset, limit: PAGE_SIZE },
    { enabled: tab === "mine", retry: false }
  );
  const sharedQuery = trpc.fluxusComplementary.sharedWithMe.useQuery(
    { offset: sharedOffset, limit: PAGE_SIZE },
    { enabled: tab === "shared", retry: false }
  );
  const detailQuery = trpc.fluxusComplementary.get.useQuery(
    { reportId: selectedReportId ?? 0 },
    { enabled: selectedReportId !== null, retry: false }
  );
  const uploadMutation = trpc.fluxusComplementary.upload.useMutation({
    onSuccess: detail => {
      focusConferenceAfterUploadRef.current = true;
      setSelectedReportId(detail.id);
      setSelectedDetail(detail);
      setDraft(detail.status === "pending" ? draftFromDetail(detail) : null);
      setSourceDate(detail.sourceDate ?? "");
      setIdentityConfirmed(false);
      setConsentAccepted(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTab("mine");
      setMineOffset(0);
      setUploadFeedback({
        tone: "success",
        message:
          "PDF recebido. A conferência pendente foi aberta abaixo; revise os dados antes de confirmar.",
      });
      void Promise.resolve(utils.fluxusComplementary.mine.invalidate()).catch(
        () => undefined
      );
      toast.success("PDF recebido. Confira os dados antes de confirmar.");
    },
    onError: error => {
      const message = error.message || "Não foi possível enviar o PDF.";
      setUploadFeedback({ tone: "error", message });
      toast.error(message);
    },
    onSettled: () => {
      uploadBusyRef.current = false;
      setUploadBusy(false);
      setUploadPhase(null);
    },
  });
  const confirmMutation = trpc.fluxusComplementary.confirm.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fluxusComplementary.mine.invalidate(),
        utils.fluxusComplementary.sharedWithMe.invalidate(),
      ]);
      clearSelection();
      clearUploadDraft();
      toast.success("Avaliação complementar confirmada.");
    },
    onError: error =>
      toast.error(error.message || "Não foi possível confirmar os dados."),
  });
  const revokeMutation = trpc.fluxusComplementary.revoke.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fluxusComplementary.mine.invalidate(),
        utils.fluxusComplementary.sharedWithMe.invalidate(),
      ]);
      clearSelection();
      clearUploadDraft();
      toast.success(
        "Importação revogada. O PDF e os resultados foram removidos do sistema ativo."
      );
    },
    onError: error =>
      toast.error(error.message || "Não foi possível revogar a importação."),
  });
  const downloadMutation = trpc.fluxusComplementary.download.useMutation();
  useEffect(() => {
    if (mineQuery.data) {
      setMineReports(current =>
        mineOffset === 0
          ? mineQuery.data.reports
          : [...current, ...mineQuery.data.reports]
      );
    }
  }, [mineQuery.data, mineOffset]);

  useEffect(() => {
    if (sharedQuery.data) {
      setSharedReports(current =>
        sharedOffset === 0
          ? sharedQuery.data.reports
          : [...current, ...sharedQuery.data.reports]
      );
    }
  }, [sharedQuery.data, sharedOffset]);

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail || detail.id !== selectedReportId) return;
    setSelectedDetail(detail);
    if (detail.status === "pending") {
      setDraft(current => current ?? draftFromDetail(detail));
      setSourceDate(current => current || detail.sourceDate || "");
    }
  }, [detailQuery.data, selectedReportId]);

  useEffect(() => {
    if (
      !focusConferenceAfterUploadRef.current ||
      selectedReportId === null ||
      !selectedDetail
    ) {
      return;
    }
    const conference = conferenceRef.current;
    if (!conference) return;
    focusConferenceAfterUploadRef.current = false;
    conference.scrollIntoView?.({ behavior: "smooth", block: "start" });
    conference.focus({ preventScroll: true });
  }, [selectedDetail, selectedReportId]);

  const availability = availabilityQuery.data;
  const termsVersionCurrent =
    availability?.termsVersion === COMPLEMENTARY_TERMS_VERSION;
  useEffect(() => {
    if (availability && !termsVersionCurrent) setConsentAccepted(false);
  }, [availability?.termsVersion, termsVersionCurrent]);
  const minePage = mineOffset === 0 ? mineQuery.data?.reports : null;
  const sharedPage = sharedOffset === 0 ? sharedQuery.data?.reports : null;
  const visibleMineReports = minePage ?? mineReports;
  const visibleSharedReports = sharedPage ?? sharedReports;
  const visibleReports =
    tab === "mine" ? visibleMineReports : visibleSharedReports;
  const listQuery = tab === "mine" ? mineQuery : sharedQuery;
  const selectedIsPending =
    selectedDetail?.status === "pending" && selectedDetail.isOwner;
  const selectedValuesComplete =
    draft && selectedDetail
      ? isCompleteComplementaryDraft(draft, selectedDetail.kind)
      : false;
  const saving =
    uploadBusy ||
    uploadMutation.isPending ||
    confirmMutation.isPending ||
    revokeMutation.isPending;
  const uploadReady = Boolean(
    availability?.enabled &&
      availability.eligible &&
      file &&
      isValidComplementaryPdf(file) &&
      consentAccepted &&
      termsVersionCurrent &&
      !uploadBusy &&
      !uploadMutation.isPending
  );
  const consentText = useMemo(
    () =>
      complementaryConsentText(
        (availability?.recipients ?? []).filter(recipient =>
          recipientUserIds.includes(recipient.id)
        )
      ),
    [availability?.recipients, recipientUserIds]
  );
  useEffect(() => {
    setConsentAccepted(false);
  }, [consentText]);

  function clearUploadDraft() {
    setFile(null);
    setFileError(null);
    setConsentAccepted(false);
    setRecipientUserIds([]);
    setKind("pq");
    setContext("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearSelection() {
    setSelectedReportId(null);
    setSelectedDetail(null);
    setDraft(null);
    setSourceDate("");
    setContext("");
    setIdentityConfirmed(false);
  }

  function openReport(reportId: number) {
    setSelectedReportId(reportId);
    setSelectedDetail(null);
    setDraft(null);
    setSourceDate("");
    setContext("");
    setIdentityConfirmed(false);
  }

  function requestOpenReport(reportId: number) {
    if (selectedIsPending) {
      setDiscardTarget(reportId);
      return;
    }
    openReport(reportId);
  }

  function requestCloseDetail() {
    if (selectedIsPending) {
      setDiscardTarget("close");
      return;
    }
    clearSelection();
  }

  function finishDiscard() {
    const target = discardTarget;
    setDiscardTarget(null);
    if (target === "close") clearSelection();
    else if (typeof target === "number") openReport(target);
  }

  function handleFileChange(nextFile: File | null) {
    setFileError(null);
    setUploadFeedback(null);
    setConsentAccepted(false);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (nextFile.size <= 0) {
      setFileError("O arquivo está vazio. Escolha um PDF com conteúdo.");
      setFile(null);
      return;
    }
    if (nextFile.size > COMPLEMENTARY_MAX_PDF_BYTES) {
      setFileError("O PDF deve ter no máximo 5 MiB.");
      setFile(null);
      return;
    }
    if (
      !(nextFile.type === "application/pdf" || /\.pdf$/i.test(nextFile.name))
    ) {
      setFileError("Escolha um arquivo PDF.");
      setFile(null);
      return;
    }
    setFile(nextFile);
  }

  async function handleUpload() {
    if (uploadBusyRef.current || uploadMutation.isPending) return;
    if (!availability?.enabled || !availability.eligible) return;
    if (!termsVersionCurrent) {
      setConsentAccepted(false);
      const message =
        "O termo de consentimento foi atualizado. Revise a versão vigente antes de enviar.";
      setUploadFeedback({ tone: "error", message });
      toast.error(message);
      return;
    }
    if (!file || !isValidComplementaryPdf(file)) {
      setFileError("Escolha um PDF válido, não vazio e de até 5 MiB.");
      return;
    }
    if (!consentAccepted) {
      const message = "Leia e autorize a importação antes de enviar.";
      setUploadFeedback({ tone: "error", message });
      toast.error(message);
      return;
    }
    const selectedFile = file;
    uploadBusyRef.current = true;
    setUploadBusy(true);
    setUploadPhase("reading");
    setUploadFeedback({
      tone: "status",
      message: "Lendo o PDF localmente… aguarde antes de clicar novamente.",
    });
    try {
      // O arquivo só é lido localmente depois do consentimento explícito.
      const pdfBase64 = await readFileAsBase64(selectedFile);
      setUploadPhase("sending");
      setUploadFeedback({
        tone: "status",
        message:
          "PDF lido localmente. Enviando para criar a conferência pendente…",
      });
      try {
        await uploadMutation.mutateAsync({
          kind,
          fileName: selectedFile.name,
          pdfBase64,
          consentAccepted: true,
          termsVersion: COMPLEMENTARY_TERMS_VERSION,
          consentText,
          recipientUserIds,
          context: context.trim() || undefined,
        });
      } catch (error) {
        // O callback da mutação também mantém o erro visível; este fallback
        // cobre adaptadores que rejeitam sem executar o callback configurado.
        setUploadFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível enviar o PDF.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível ler o PDF localmente.";
      setUploadFeedback({ tone: "error", message });
      toast.error(message);
    } finally {
      uploadBusyRef.current = false;
      setUploadBusy(false);
      setUploadPhase(null);
    }
  }

  function updateDraft(field: "pq", value: string): void;
  function updateDraft(
    field: SaboteurKey,
    value: string,
    group: "saboteurs"
  ): void;
  function updateDraft(field: CriticKey, value: string, group: "critic"): void;
  function updateDraft(
    field: "pq" | SaboteurKey | CriticKey,
    value: string,
    group?: "saboteurs" | "critic"
  ) {
    setDraft(current => {
      if (!current) return current;
      if (field === "pq") return { ...current, pq: value };
      if (group === "saboteurs") {
        return {
          ...current,
          saboteurs: { ...current.saboteurs, [field]: value },
        };
      }
      return { ...current, critic: { ...current.critic, [field]: value } };
    });
  }

  function handleConfirm() {
    if (!availability?.enabled || !availability.eligible) {
      toast.error(
        "A confirmação está temporariamente indisponível; você pode retirar esta importação."
      );
      return;
    }
    if (!selectedDetail || !draft || !sourceDate || !selectedValuesComplete) {
      toast.error(
        selectedDetail?.kind === "saboteurs"
          ? "Preencha a data e os nove Sabotadores; os campos de Crítica são opcionais e usam escala de 1 a 15."
          : "Preencha a data e a pontuação QP antes de confirmar."
      );
      return;
    }
    if (!identityConfirmed) {
      toast.error("Confirme explicitamente que o relatório é seu.");
      return;
    }
    confirmMutation.mutate({
      reportId: selectedDetail.id,
      expectedRevision: selectedDetail.revision,
      sourceDate,
      values: draftToValues(draft),
      identityConfirmed: true,
    });
  }

  async function handleDownload(detail: ComplementaryDetail) {
    try {
      const result = await downloadMutation.mutateAsync({
        reportId: detail.id,
      });
      const binary = window.atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível baixar o PDF."
      );
    }
  }

  function requestRevoke(detail: ComplementaryDetail) {
    if (
      window.confirm(
        `Revogar a importação de ${detail.sourceName || detail.fileName || "este relatório"}? O PDF, os resultados e o acesso compartilhado serão removidos do sistema ativo.`
      )
    ) {
      revokeMutation.mutate({
        reportId: detail.id,
        expectedRevision: detail.revision,
      });
    }
  }

  function selectTab(nextTab: Tab) {
    if (selectedIsPending) {
      setDiscardTarget("close");
      return;
    }
    setTab(nextTab);
  }

  const selectedDetailLoading =
    selectedReportId !== null &&
    !selectedDetail &&
    (detailQuery.isLoading || detailQuery.isFetching);
  const selectedDetailError = selectedReportId !== null && detailQuery.error;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Fluxus Persona · etapa opcional
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Avaliações complementares — Inteligência Positiva
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Organize seus próprios relatórios de QP e Sabotadores para apoiar
              autoconhecimento e conversas de desenvolvimento. A importação é
              opcional, não altera o Persona nem o Feedback e nunca substitui
              contexto ou conversa.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/fluxus")}
            className="gap-2 self-start"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Persona
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
            <LockKeyhole className="h-3.5 w-3.5" /> PDF protegido, sem URL
            pública
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Confirmação humana
            obrigatória
          </span>
        </div>
      </section>

      {availabilityQuery.error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não foi possível consultar a disponibilidade. Seus relatórios
            existentes continuam acessíveis.
          </AlertDescription>
        </Alert>
      ) : null}
      {availabilityQuery.isLoading ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : null}
      {availability && !availability.enabled ? (
        <StatusCard>
          <strong>Aguardando validação de permissões e privacidade.</strong> A
          importação está temporariamente indisponível para novos envios. Seus
          relatórios próprios e retiradas continuam disponíveis.
        </StatusCard>
      ) : null}
      {availability && availability.enabled && !availability.eligible ? (
        <StatusCard>
          Conclua o Persona para liberar esta etapa opcional. A participação não
          é necessária para concluir o Persona.
        </StatusCard>
      ) : null}

      {availability?.enabled && availability.eligible ? (
        <UploadCard
          availability={availability}
          termsVersionCurrent={termsVersionCurrent}
          kind={kind}
          onKindChange={nextKind => {
            setKind(nextKind);
            setConsentAccepted(false);
            setUploadFeedback(null);
          }}
          file={file}
          fileError={fileError}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          recipientUserIds={recipientUserIds}
          setRecipientUserIds={setRecipientUserIds}
          consentText={consentText}
          consentAccepted={consentAccepted}
          setConsentAccepted={setConsentAccepted}
          context={context}
          setContext={setContext}
          onUpload={handleUpload}
          uploadReady={uploadReady}
          pending={uploadBusy || uploadMutation.isPending}
          phase={uploadPhase}
          feedback={uploadFeedback}
        />
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Histórico protegido
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              Seus relatórios e acessos recebidos
            </h2>
          </div>
          <div
            className="flex rounded-xl border border-border/60 bg-muted/30 p-1"
            role="tablist"
            aria-label="Relatórios complementares"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "mine"}
              onClick={() => selectTab("mine")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === "mine" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Meus relatórios
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "shared"}
              onClick={() => selectTab("shared")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === "shared" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Compartilhados comigo
            </button>
          </div>
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : listQuery.error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {tab === "mine"
                ? "Não foi possível carregar seus relatórios."
                : "Não foi possível carregar os relatórios compartilhados com você."}{" "}
              {listQuery.error.message}
            </AlertDescription>
          </Alert>
        ) : visibleReports.length === 0 ? (
          <Card className="border-dashed border-border/70">
            <CardContent className="p-8 text-center">
              <FileCheck2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">
                {tab === "mine"
                  ? "Nenhum relatório próprio importado."
                  : "Nenhum relatório compartilhado com você."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === "mine"
                  ? "Se decidir participar, use o formulário acima para enviar um PDF por vez."
                  : "O acesso só aparece depois que o titular confere e confirma o relatório."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleReports.map(report => (
              <ReportSummaryCard
                key={`${report.id}-${report.revision}`}
                report={report}
                shared={tab === "shared"}
                onOpen={() => requestOpenReport(report.id)}
              />
            ))}
          </div>
        )}
        {listQuery.data?.hasMore ? (
          <Button
            variant="outline"
            onClick={() =>
              tab === "mine"
                ? setMineOffset(current => current + PAGE_SIZE)
                : setSharedOffset(current => current + PAGE_SIZE)
            }
            disabled={listQuery.isFetching}
            className="gap-2"
          >
            {listQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Carregar mais 20
          </Button>
        ) : null}
      </section>

      {selectedReportId !== null ? (
        <div
          ref={conferenceRef}
          tabIndex={-1}
          className="scroll-mt-6 outline-none"
        >
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="border-b border-border/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {selectedIsPending
                      ? "Conferir relatório pendente"
                      : "Detalhes da avaliação complementar"}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {selectedIsPending
                      ? "Confira cada campo. O sistema não inventa pontuações quando o gráfico não fornece texto."
                      : "Leitura protegida e separada do Persona/Feedback; estes dados não são uma medida de desempenho."}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  onClick={requestCloseDetail}
                  disabled={saving}
                >
                  Fechar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {selectedDetailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
              ) : selectedDetailError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Não foi possível abrir este relatório. Os demais relatórios
                    continuam acessíveis. {detailQuery.error?.message}
                  </AlertDescription>
                </Alert>
              ) : selectedDetail && selectedIsPending && draft ? (
                <PendingEditor
                  detail={selectedDetail}
                  draft={draft}
                  sourceDate={sourceDate}
                  setSourceDate={setSourceDate}
                  identityConfirmed={identityConfirmed}
                  setIdentityConfirmed={setIdentityConfirmed}
                  updateDraft={updateDraft}
                  onConfirm={handleConfirm}
                  onDiscard={requestCloseDetail}
                  onRevoke={() => requestRevoke(selectedDetail)}
                  canConfirm={Boolean(
                    availability?.enabled &&
                      availability.eligible &&
                      sourceDate &&
                      selectedValuesComplete &&
                      identityConfirmed
                  )}
                  saving={saving}
                />
              ) : selectedDetail ? (
                <ConfirmedDetail
                  detail={selectedDetail}
                  onDownload={() => handleDownload(selectedDetail)}
                  downloading={downloadMutation.isPending}
                  onRevoke={
                    selectedDetail.isOwner
                      ? () => requestRevoke(selectedDetail)
                      : undefined
                  }
                  revoking={revokeMutation.isPending}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <AlertDialog
        open={discardTarget !== null}
        onOpenChange={open => !open && setDiscardTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar conferência pendente?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações locais desta conferência não são salvas
              automaticamente. Para continuar, descarte-as conscientemente e
              faça uma nova leitura do relatório quando necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar conferindo</AlertDialogCancel>
            <AlertDialogAction onClick={finishDiscard}>
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex items-start gap-3 p-5 text-sm leading-relaxed">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
        <p>{children}</p>
      </CardContent>
    </Card>
  );
}

function UploadCard({
  availability,
  termsVersionCurrent,
  kind,
  onKindChange,
  file,
  fileError,
  fileInputRef,
  onFileChange,
  recipientUserIds,
  setRecipientUserIds,
  consentText,
  consentAccepted,
  setConsentAccepted,
  context,
  setContext,
  onUpload,
  uploadReady,
  pending,
  phase,
  feedback,
}: {
  availability: {
    termsVersion: string;
    recipients: ComplementaryRecipient[];
  };
  termsVersionCurrent: boolean;
  kind: ComplementaryKind;
  onKindChange: (kind: ComplementaryKind) => void;
  file: File | null;
  fileError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (file: File | null) => void;
  recipientUserIds: number[];
  setRecipientUserIds: React.Dispatch<React.SetStateAction<number[]>>;
  consentText: string;
  consentAccepted: boolean;
  setConsentAccepted: (accepted: boolean) => void;
  context: string;
  setContext: (value: string) => void;
  onUpload: () => void;
  uploadReady: boolean;
  pending: boolean;
  phase: UploadPhase;
  feedback: UploadFeedback | null;
}) {
  return (
    <Card className="border-orange-500/30 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5 text-orange-600 dark:text-orange-300" />{" "}
          Importar um PDF seu
        </CardTitle>
        <CardDescription>
          Você pode importar QP e Sabotadores separadamente, sempre um PDF por
          vez. Selecione o tipo correspondente ao arquivo; a leitura fica local
          até este consentimento ser marcado e nenhum PDF é enviado a serviço
          externo de IA.
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          Cada envio exige um novo consentimento. Para importar os dois tipos,
          autorize cada PDF separadamente.
        </p>
      </CardHeader>
      <CardContent>
        <fieldset disabled={pending} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <label className="text-sm">
              <span className="mb-2 block font-medium">Tipo de relatório</span>
              <select
                value={kind}
                onChange={event =>
                  onKindChange(event.target.value as ComplementaryKind)
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="pq">QP (0–100)</option>
                <option value="saboteurs">Sabotadores (0–10)</option>
              </select>
            </label>
            <div className="space-y-2">
              <span className="block text-sm font-medium">
                Fonte oficial para conferir a escala
              </span>
              <div className="flex flex-wrap gap-3 text-sm">
                <a
                  href={OFFICIAL_ASSESSMENT_URLS.pq}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  Conferir QP
                </a>
                <a
                  href={OFFICIAL_ASSESSMENT_URLS.saboteurs}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  Conferir Sabotadores
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                A fonte oficial abre em nova aba. O Fluxus não preenche
                formulários externos.
              </p>
              <p className="text-xs text-muted-foreground">
                Exemplos: <code>PQ_Assessment_Report</code> para QP e{" "}
                <code>Saboteur_Assessment_Results</code> para Sabotadores.
              </p>
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium"
              htmlFor="complementary-pdf"
            >
              Arquivo PDF
            </label>
            <Input
              ref={fileInputRef}
              id="complementary-pdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={event => onFileChange(event.target.files?.[0] ?? null)}
              className="mt-2 file:mr-3"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              PDF não vazio, máximo de 5 MiB. O nome e o tipo também serão
              validados no servidor.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Envie o relatório de resultado do próprio titular. O nome dentro
              do PDF deve corresponder ao cadastro; renomear o arquivo não muda
              o titular.
            </p>
            {file ? (
              <p className="mt-2 text-sm text-foreground">
                Selecionado: {file.name}
              </p>
            ) : null}
            {fileError ? (
              <p
                role="alert"
                aria-live="assertive"
                className="mt-2 text-sm text-destructive"
              >
                {fileError}
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-medium">
              Leitores escolhidos (opcional)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhuma pessoa é selecionada automaticamente. Ser gestor ou
              administrador não concede acesso.
            </p>
            {availability.recipients.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {availability.recipients.map(recipient => (
                  <label
                    key={recipient.id}
                    className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={recipientUserIds.includes(recipient.id)}
                      onChange={event => {
                        setRecipientUserIds(current =>
                          event.target.checked
                            ? [...current, recipient.id]
                            : current.filter(id => id !== recipient.id)
                        );
                        setConsentAccepted(false);
                      }}
                      className="persona-complementary-checkbox mt-0.5 h-4 w-4 accent-orange-600"
                    />
                    <span>
                      <strong>{recipient.name}</strong>
                      <span className="block text-xs text-muted-foreground">
                        {recipient.roleLabel}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                Você pode guardar o relatório somente para você.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-sm leading-relaxed">
            <p className="font-medium">
              Consentimento específico · termo {availability.termsVersion}
            </p>
            <p className="mt-2 text-muted-foreground">{consentText}</p>
            {!termsVersionCurrent ? (
              <p className="mt-3 text-sm font-medium text-destructive">
                O termo vigente mudou. Atualize a página e revise o
                consentimento antes de enviar.
              </p>
            ) : null}
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-orange-500/40 bg-background/70 p-3">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={event => setConsentAccepted(event.target.checked)}
                disabled={!termsVersionCurrent}
                className="persona-complementary-consent mt-0.5 h-4 w-4 accent-orange-600"
              />
              <span className="font-medium">
                Li e autorizo esta importação, finalidade e estes leitores.
              </span>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-2 block font-medium">
              Contexto do relatório (opcional)
            </span>
            <Textarea
              value={context}
              onChange={event => setContext(event.target.value)}
              placeholder="Ex.: resultado de uma aplicação realizada em determinado período..."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <UploadFeedbackMessage feedback={feedback} />
            <Button
              onClick={onUpload}
              disabled={!uploadReady}
              className="gap-2"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {pending
                ? phase === "reading"
                  ? "Lendo PDF..."
                  : "Enviando PDF..."
                : "Enviar para conferir"}
            </Button>
            <p className="text-xs text-muted-foreground">
              O envio só libera a conferência; nada é compartilhado antes da
              confirmação.
            </p>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}

function ReportSummaryCard({
  report,
  shared,
  onOpen,
}: {
  report: ComplementarySummary;
  shared: boolean;
  onOpen: () => void;
}) {
  const statusLabel =
    report.status === "pending"
      ? "Pendente"
      : report.status === "revoked"
        ? "Revogado"
        : "Confirmado";
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={report.status === "confirmed" ? "default" : "secondary"}
            >
              {statusLabel}
            </Badge>
            <Badge variant="outline">
              {report.kind === "pq" ? "QP" : "Sabotadores"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Revisão {report.revision}
            </span>
          </div>
          <p className="mt-2 font-medium">
            {shared
              ? `Relatório de ${report.ownerName}`
              : report.ownerName === ""
                ? "Meu relatório"
                : "Meu relatório"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Data da fonte: {formatCalendarDate(report.sourceDate)} · Criado em{" "}
            {formatDateTime(report.createdAt)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {shared
              ? `Leitores autorizados: ${report.recipientNames.join(", ") || "não informado"}`
              : `Compartilhado com: ${report.recipientNames.join(", ") || "somente você"}`}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onOpen}
          disabled={report.status === "revoked"}
          className="shrink-0 gap-2"
        >
          {report.status === "pending"
            ? "Continuar conferência"
            : "Abrir detalhes"}
          <ArrowDownToLine className="h-4 w-4 rotate-[-45deg]" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function PendingEditor({
  detail,
  draft,
  sourceDate,
  setSourceDate,
  identityConfirmed,
  setIdentityConfirmed,
  updateDraft,
  onConfirm,
  onDiscard,
  onRevoke,
  canConfirm,
  saving,
}: {
  detail: ComplementaryDetail;
  draft: DraftValues;
  sourceDate: string;
  setSourceDate: (value: string) => void;
  identityConfirmed: boolean;
  setIdentityConfirmed: (value: boolean) => void;
  updateDraft: {
    (field: "pq", value: string): void;
    (field: SaboteurKey, value: string, group: "saboteurs"): void;
    (field: CriticKey, value: string, group: "critic"): void;
  };
  onConfirm: () => void;
  onDiscard: () => void;
  onRevoke: () => void;
  canConfirm: boolean;
  saving: boolean;
}) {
  return (
    <fieldset disabled={saving} className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm sm:grid-cols-3">
        <div>
          <span className="block text-xs text-muted-foreground">
            Nome identificado
          </span>
          <strong>
            {detail.sourceName || detail.fileName || "Não informado"}
          </strong>
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">
            Arquivo recebido
          </span>
          <strong className="break-all">{detail.fileName || "PDF"}</strong>
        </div>
        <label>
          <span className="mb-2 block text-xs text-muted-foreground">
            Data da aplicação / fonte
          </span>
          <Input
            type="date"
            value={sourceDate}
            onChange={event => setSourceDate(event.target.value)}
          />
        </label>
      </div>

      {detail.warnings.length ? (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Confira manualmente:</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {detail.warnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {detail.kind === "pq" ? (
          <section className="rounded-xl border border-border/60 p-4">
            <h3 className="font-semibold">QP</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Escala obrigatória de 0 a 100. Deixe em branco quando o relatório
              não fornecer a pontuação; nunca use zero por ausência.
            </p>
            <label className="mt-4 block text-sm">
              <span className="mb-2 block font-medium">QP (0–100)</span>
              <Input
                type="number"
                min="0"
                max="100"
                step="any"
                value={draft.pq}
                onChange={event => updateDraft("pq", event.target.value)}
              />
            </label>
          </section>
        ) : (
          <section className="rounded-xl border border-border/60 p-4">
            <h3 className="font-semibold">Sabotadores</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Nove campos obrigatórios na escala de 0 a 10. Preencha apenas o
              que foi confirmado no relatório.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {SABOTEUR_KEYS.map(key => (
                <label key={key} className="text-sm">
                  <span className="mb-1.5 block font-medium">
                    {SABOTEUR_LABELS[key]}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="any"
                    value={draft.saboteurs[key]}
                    onChange={event =>
                      updateDraft(key, event.target.value, "saboteurs")
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        )}
      </div>

      {detail.kind === "saboteurs" ? (
        <section className="rounded-xl border border-border/60 p-4">
          <h3 className="font-semibold">Crítico</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Escala opcional de 1 a 15. Campos em branco significam que o gráfico
            não trouxe texto suficiente para uma confirmação humana.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {CRITIC_KEYS.map(key => (
              <label key={key} className="text-sm">
                <span className="mb-1.5 block font-medium">
                  {CRITIC_LABELS[key]}
                </span>
                <Input
                  type="number"
                  min="1"
                  max="15"
                  step="any"
                  value={draft.critic[key]}
                  onChange={event =>
                    updateDraft(key, event.target.value, "critic")
                  }
                />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {detail.context ? (
        <div className="rounded-xl border border-border/60 p-4 text-sm">
          <strong>Contexto informado no envio</strong>
          <p className="mt-2 whitespace-pre-wrap">{detail.context}</p>
        </div>
      ) : null}

      <label className="flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={identityConfirmed}
          onChange={event => setIdentityConfirmed(event.target.checked)}
          className="persona-complementary-identity mt-0.5 h-4 w-4 accent-orange-600"
        />
        <span>
          Confirmo que este relatório é meu, que revisei os campos e que entendi
          que os resultados são autorrelato contextual, não diagnóstico nem
          medida de capacidade ou produtividade.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onConfirm}
          disabled={!canConfirm || saving}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {saving
            ? "Salvando confirmação..."
            : detail.recipients.length
              ? "Confirmar e compartilhar"
              : "Confirmar somente para mim"}
        </Button>
        <Button
          variant="outline"
          onClick={onDiscard}
          disabled={saving}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" /> Descartar conferência
        </Button>
        <Button
          variant="outline"
          onClick={onRevoke}
          disabled={saving}
          className="gap-2 text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Excluir importação pendente
        </Button>
        {!sourceDate || !isCompleteComplementaryDraft(draft, detail.kind) ? (
          <p className="basis-full text-xs text-amber-700 dark:text-amber-300">
            {detail.kind === "pq"
              ? "A confirmação exige data e QP válido."
              : "A confirmação exige data e os nove Sabotadores válidos; Crítico é opcional."}
            Pontuações ausentes permanecem em branco.
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}

function ConfirmedDetail({
  detail,
  onDownload,
  downloading,
  onRevoke,
  revoking,
}: {
  detail: ComplementaryDetail;
  onDownload: () => void;
  downloading: boolean;
  onRevoke?: () => void;
  revoking: boolean;
}) {
  const values = detail.values ?? emptyComplementaryValues();
  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm sm:grid-cols-4">
        <div>
          <span className="block text-xs text-muted-foreground">Fonte</span>
          <strong>
            {detail.sourceName || detail.fileName || "Não informado"}
          </strong>
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">
            Data da aplicação
          </span>
          <strong>{formatCalendarDate(detail.sourceDate)}</strong>
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">
            Confirmado em
          </span>
          <strong>{formatDateTime(detail.confirmedAt)}</strong>
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Leitores</span>
          <strong>
            {detail.recipients
              .map(recipient => `${recipient.name} (${recipient.roleLabel})`)
              .join(", ") || "Somente você"}
          </strong>
        </div>
      </div>
      <p className="rounded-xl border border-border/60 p-4 text-sm leading-relaxed text-muted-foreground">
        Leitura exploratória separada do Persona e do Feedback. Estes resultados
        não geram diagnóstico, limiar, ranking, nota de desempenho ou decisão de
        emprego.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <ScoreGroup
          title="QP"
          description="Escala 0–100"
          items={[["QP", values.pq]]}
        />
        <ScoreGroup
          title="Sabotadores"
          description="Escala 0–10"
          items={SABOTEUR_KEYS.map(key => [
            SABOTEUR_LABELS[key],
            values.saboteurs[key] ?? null,
          ])}
        />
        <ScoreGroup
          title="Crítico"
          description="Escala 1–15 · opcional"
          items={CRITIC_KEYS.map(key => [
            CRITIC_LABELS[key],
            values.critic[key] ?? null,
          ])}
        />
      </div>
      {detail.context ? (
        <div className="rounded-xl border border-border/60 p-4 text-sm">
          <strong>Contexto</strong>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {detail.context}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={onDownload}
          disabled={downloading}
          className="gap-2"
        >
          <ArrowDownToLine className="h-4 w-4" />{" "}
          {downloading ? "Preparando PDF..." : "Baixar PDF protegido"}
        </Button>
        {onRevoke ? (
          <Button
            variant="destructive"
            onClick={onRevoke}
            disabled={revoking}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />{" "}
            {revoking ? "Revogando..." : "Revogar importação"}
          </Button>
        ) : null}
      </div>
      {onRevoke ? (
        <p className="text-xs text-muted-foreground">
          Para corrigir resultados depois da confirmação, revogue esta
          importação e faça um novo upload. A alteração não é aplicada
          silenciosamente.
        </p>
      ) : null}
    </div>
  );
}

function ScoreGroup({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<[string, number | null | undefined]>;
}) {
  return (
    <section className="rounded-xl border border-border/60 p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <dl className="mt-4 space-y-2 text-sm">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-b-0 last:pb-0"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold">
              {value == null ? "Não informado" : value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}
