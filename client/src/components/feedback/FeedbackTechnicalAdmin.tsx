import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { feedbackApi } from "@/lib/feedbackApi";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { FeedbackOrganization } from "./FeedbackWorkspace";
import {
  PageHeader,
  LoadingCards,
  QueryFailure,
  errorMessage,
} from "./FeedbackShared";

export function FeedbackTechnicalAdminPage({
  params,
}: {
  params: { id: string };
}) {
  const companyId = Number(params.id);
  const query = feedbackApi.workspace.useQuery(
    { companyId },
    { retry: false, enabled: Number.isInteger(companyId) && companyId > 0 }
  );
  const data = query.data;
  const [userId, setUserId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const bootstrap = feedbackApi.bootstrapCompanyAdmin.useMutation();
  if (query.isLoading) return <LoadingCards count={4} />;
  if (query.error || !data)
    return (
      <QueryFailure
        error={query.error}
        onRetry={() => void query.refetch()}
        message="Não foi possível carregar os metadados da empresa."
      />
    );
  const submitBootstrap = async () => {
    if (!userId || !confirmed) return;
    try {
      await bootstrap.mutateAsync({ companyId, userId: Number(userId) });
      toast.success(
        "Bootstrap administrativo concluído sem concessão de leitura."
      );
      setConfirmed(false);
      await query.refetch();
    } catch (error) {
      toast.error(
        errorMessage(error, "Não foi possível realizar o bootstrap.")
      );
    }
  };
  return (
    <div className="min-h-full bg-muted/20 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Administração técnica · Fluxus Feedback"
          title={`Empresa #${companyId}`}
          description="Use o identificador explícito da empresa para bootstrap administrativo. Esta tela nunca concede leitura de conteúdo por papel técnico."
        >
          <Link href={`/fluxus/admin/empresa/${companyId}`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Empresa
            </Button>
          </Link>
        </PageHeader>
        <Alert>
          <LockKeyhole className="h-4 w-4" />
          <AlertTitle>Somente metadados e operação</AlertTitle>
          <AlertDescription>
            O acesso técnico não recebe respostas, notas, evidências ou
            resultados Persona. A API continua sendo a autoridade para escopo e
            conteúdo.
          </AlertDescription>
        </Alert>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">
              Bootstrap de administrador da empresa
            </CardTitle>
            <CardDescription>
              A operação cria um membership company_admin com
              canReadFeedback=false. Informe o ID interno do usuário e confirme
              explicitamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="bootstrap-user">ID do usuário</Label>
              <Input
                id="bootstrap-user"
                inputMode="numeric"
                value={userId}
                onChange={event =>
                  setUserId(event.target.value.replace(/\D/g, ""))
                }
                placeholder="Ex.: 123"
              />
            </div>
            <label className="flex max-w-2xl items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <Checkbox
                checked={confirmed}
                onCheckedChange={value => setConfirmed(value === true)}
              />
              <span className="text-sm leading-relaxed">
                Confirmo que o usuário indicado deve receber somente a
                administração operacional desta empresa, sem leitura automática
                de feedback.
              </span>
            </label>
            <Button
              onClick={() => void submitBootstrap()}
              disabled={bootstrap.isPending || !userId || !confirmed}
              className="gap-2"
            >
              <ShieldCheck className="h-4 w-4" />{" "}
              {bootstrap.isPending ? "Aplicando…" : "Confirmar bootstrap"}
            </Button>
          </CardContent>
        </Card>
        {data.enabled && data.canConfigure ? (
          <FeedbackOrganization
            workspace={data}
            onRefresh={() => void query.refetch()}
          />
        ) : (
          <Card className="border-border/60">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                A empresa ainda não possui membership operacional para a sessão
                técnica atual. Use o bootstrap acima e peça ao administrador da
                empresa para entrar pelo workspace Fluxus.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
