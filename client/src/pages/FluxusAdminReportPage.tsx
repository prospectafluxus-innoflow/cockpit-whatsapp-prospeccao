import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FluxusReportTabs } from "@/components/fluxus/FluxusReportTabs";
import { FluxusDebriefGuide } from "@/components/fluxus/FluxusDebriefGuide";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download } from "lucide-react";
import { useLocation } from "wouter";

export default function FluxusAdminReportPage({
  params,
}: {
  params: { id: string };
}) {
  const assessmentId = Number(params.id);
  const [location, navigate] = useLocation();
  const isPlatformAdminRoute = location.startsWith("/fluxus/admin/");
  const { data, isLoading, error } = trpc.fluxus.adminAssessment.useQuery(
    { assessmentId },
    { enabled: Number.isInteger(assessmentId) && assessmentId > 0 }
  );

  if (isLoading)
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-[620px] rounded-3xl" />
      </div>
    );
  if (error || !data)
    return (
      <div className="p-8 text-sm text-destructive">
        {error?.message || "Relatório não encontrado."}
      </div>
    );

  return (
    <div className="min-h-full bg-muted/20 p-4 sm:p-6 lg:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Button
            variant="ghost"
            onClick={() =>
              navigate(
                isPlatformAdminRoute
                  ? `/fluxus/admin/empresa/${data.assessment.companyId}`
                  : "/fluxus/equipe"
              )
            }
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Download className="h-4 w-4" /> Imprimir / salvar PDF
          </Button>
        </div>
        <FluxusReportTabs
          result={data.assessment.result!}
          personName={data.person?.name}
          companyName={data.company?.name}
          jobTitle={data.person?.jobTitle}
          department={data.person?.department}
          audience="manager"
        />
        <FluxusDebriefGuide
          assessmentId={data.assessment.id}
          initial={data.debrief}
        />
      </div>
    </div>
  );
}
