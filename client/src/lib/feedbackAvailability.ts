export function feedbackAvailabilityMessage(workspace: {
  moduleEnabled?: boolean;
  unavailableReason?:
    | "module_disabled"
    | "company_missing"
    | "membership_required"
    | null;
}) {
  if (
    workspace.unavailableReason === "module_disabled" ||
    workspace.moduleEnabled === false
  )
    return {
      title: "Feedback desativado neste ambiente",
      description:
        "O serviço de Feedback não está habilitado nesta instalação.",
      nextStep:
        "A administração da plataforma precisa habilitar o módulo antes de iniciar o processo.",
    };
  if (workspace.unavailableReason === "company_missing")
    return {
      title: "Conta sem empresa vinculada",
      description:
        "O módulo está ativo, mas este acesso não identifica uma empresa para o Feedback.",
      nextStep:
        "Entre com o acesso de colaborador do Fluxus Persona vinculado à sua empresa. O painel geral e o acesso do colaborador são contas distintas.",
    };
  return {
    title: "Seu acesso ao Feedback ainda não foi configurado",
    description:
      workspace.moduleEnabled === true
        ? "O módulo está ativo. Falta atribuir o acesso desta conta ao processo da empresa."
        : "É necessário conferir a configuração do seu acesso ao processo da empresa.",
    nextStep:
      "Primeiro, defina o administrador na lista de colaboradores do painel da empresa. Depois, ele entra com o próprio acesso ao Fluxus Persona para configurar o processo e os acessos da equipe. Isso não libera notas ou evidências automaticamente.",
  };
}
