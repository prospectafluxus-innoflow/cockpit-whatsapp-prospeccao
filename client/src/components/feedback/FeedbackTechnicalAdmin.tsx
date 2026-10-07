import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useLocation } from "wouter";

/** Compatibilidade com os links publicados antes da integração no cadastro. */
export function FeedbackTechnicalAdminPage({
  params,
}: {
  params: { id: string };
}) {
  const companyId = Number(params.id);
  const [, navigate] = useLocation();
  const valid = Number.isInteger(companyId) && companyId > 0;
  useEffect(() => {
    if (valid)
      navigate(`/fluxus/admin/empresa/${companyId}#papeis-de-acesso`, {
        replace: true,
      });
  }, [companyId, valid, navigate]);

  return (
    <div className="space-y-4 p-6">
      <p role="status" className="text-sm text-muted-foreground">
        {valid
          ? "A opção de administrador agora fica na lista de colaboradores da empresa. Abrindo o cadastro…"
          : "Empresa inválida. Selecione uma empresa no painel Fluxus Persona."}
      </p>
      <Button variant="outline" onClick={() => navigate("/fluxus/admin")}>
        Voltar às empresas
      </Button>
    </div>
  );
}
