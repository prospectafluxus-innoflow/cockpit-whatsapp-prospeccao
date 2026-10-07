import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFeedbackDate } from "@/lib/feedbackDates";
import { ClipboardCheck, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import type { DevelopmentCycle } from "../../../../drizzle/feedbackSchema";
import {
  CYCLE_STATUS_LABELS,
  FEEDBACK_CLASSIFICATION_LABELS,
  FEEDBACK_STATUS_LABELS,
  classifyFeedback,
  isFeedbackVisibleToParticipant,
  type FeedbackStatus,
} from "@shared/feedback";

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
export function formatDate(value: Date | string | null | undefined) {
  return formatFeedbackDate(value);
}
export function canOpenFeedbackRecord({
  participantUserId,
  viewerUserId,
  status,
  canReadContent,
}: {
  participantUserId: number;
  viewerUserId: number | null | undefined;
  status: FeedbackStatus;
  canReadContent: boolean;
}) {
  return participantUserId === viewerUserId
    ? isFeedbackVisibleToParticipant(status)
    : canReadContent;
}
export function nextQuarterStart() {
  const date = new Date();
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1)
    .toISOString()
    .slice(0, 10);
}
export function addMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
export function StatusBadge({ status }: { status: FeedbackStatus }) {
  const variant =
    status === "released" || status === "acknowledged" || status === "closed"
      ? "default"
      : status === "draft"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{FEEDBACK_STATUS_LABELS[status]}</Badge>;
}
export function CycleStatusBadge({
  status,
}: {
  status: DevelopmentCycle["status"];
}) {
  return (
    <Badge
      variant={
        status === "active"
          ? "default"
          : status === "cancelled"
            ? "destructive"
            : "secondary"
      }
    >
      {CYCLE_STATUS_LABELS[status]}
    </Badge>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {children ? (
          <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
        ) : null}
      </div>
    </section>
  );
}
export function QueryFailure({
  error,
  onRetry,
  message,
}: {
  error: unknown;
  onRetry: () => void;
  message: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{message}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{errorMessage(error, "Tente novamente em instantes.")}</span>
        <Button size="sm" variant="outline" onClick={onRetry} className="gap-2">
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof ClipboardCheck;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="border-dashed border-border/70">
      <CardContent className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
        <Icon className="h-9 w-9 text-muted-foreground" />
        <h2 className="mt-4 font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {children ? <div className="mt-5">{children}</div> : null}
      </CardContent>
    </Card>
  );
}
export function scoreLabel(score: number | null) {
  if (score === null) return "Sem nota";
  return `${score}/6 · ${FEEDBACK_CLASSIFICATION_LABELS[classifyFeedback(score)]}`;
}
export function scoreDescription(score: number) {
  return (
    [
      "Não observado no período",
      "Muito abaixo do esperado",
      "Abaixo do esperado",
      "Em desenvolvimento",
      "Atende ao esperado",
      "Acima do esperado",
      "Referência positiva",
    ][score] ?? ""
  );
}
export function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
export function InfoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
