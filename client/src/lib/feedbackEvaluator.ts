export type EvaluatorPerson = {
  id: number;
  name?: string | null;
  eligible: boolean;
  eligibilityReason?: string | null;
  assignmentId?: number | null;
  managerUserId?: number | null;
  hasFeedbackAccess?: boolean;
  allowedEvaluatorIds?: readonly number[];
  evaluatorEligibilityReason?: string | null;
};

export function resolveCycleEvaluator(
  participant: EvaluatorPerson,
  people: readonly EvaluatorPerson[],
  explicitChoice: string | undefined
) {
  const automatic = explicitChoice === undefined;
  const id = automatic
    ? (participant.managerUserId ?? null)
    : Number(explicitChoice);
  const candidate = people.find(person => person.id === id);
  const name = candidate?.name || (id ? `Usuário #${id}` : "Sem gestor direto");
  let reason: string | null = null;
  if (!participant.eligible)
    reason =
      participant.eligibilityReason ||
      "A análise Persona precisa estar concluída e válida.";
  else if (!participant.assignmentId)
    reason = "Cadastre o vínculo da pessoa em Organização > Atribuições.";
  else if (!id || !Number.isInteger(id))
    reason =
      "Vincule um gestor direto ou escolha um avaliador autorizado para este ciclo.";
  else if (id === participant.id)
    reason = "O participante não pode avaliar a si próprio.";
  else if (!candidate)
    reason = "O gestor ou avaliador não está disponível nesta empresa.";
  else if (!(participant.allowedEvaluatorIds ?? []).includes(id))
    reason =
      candidate.evaluatorEligibilityReason ||
      "Este avaliador não tem autorização no escopo desta pessoa. Confira Papéis e permissões.";
  return { id, name, candidate, automatic, reason, valid: reason === null };
}

export function evaluatorOptions(
  participant: EvaluatorPerson,
  people: readonly EvaluatorPerson[]
) {
  const allowed = new Set(participant.allowedEvaluatorIds ?? []);
  return people.filter(
    person => person.id !== participant.id && allowed.has(person.id)
  );
}

export function feedbackAccessUrl(
  companyUserId: number | null,
  cycleId: number
) {
  const params = new URLSearchParams({
    section: "organization",
    returnCycleId: String(cycleId),
  });
  if (companyUserId && Number.isInteger(companyUserId) && companyUserId > 0)
    params.set("accessUserId", String(companyUserId));
  return `/fluxus/feedback?${params.toString()}#papeis-feedback`;
}
