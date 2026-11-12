import type {
  ExecutivePreviewResponse,
  ExecutiveSelection,
} from "@shared/fluxusExecutive";

export async function revalidateExecutiveExport(input: {
  selection: ExecutiveSelection;
  reportId?: number;
  revision?: number;
  fetchPreview: (
    selection: ExecutiveSelection
  ) => Promise<ExecutivePreviewResponse>;
  fetchSaved: (id: number) => Promise<ExecutivePreviewResponse>;
}): Promise<ExecutivePreviewResponse> {
  const fresh =
    input.reportId === undefined
      ? await input.fetchPreview(input.selection)
      : await input.fetchSaved(input.reportId);
  const ids = fresh.data.people.map(person => person.assessmentId);
  if (
    fresh.data.mode !== input.selection.mode ||
    (input.selection.companyId !== undefined &&
      fresh.data.company.id !== input.selection.companyId) ||
    ids.length !== input.selection.assessmentIds.length ||
    ids.some((id, index) => id !== input.selection.assessmentIds[index])
  )
    throw new Error(
      "A seleção mudou. Gere novamente a prévia antes de imprimir."
    );
  if (
    input.reportId !== undefined &&
    (!fresh.report ||
      fresh.report.id !== input.reportId ||
      fresh.report.revision !== input.revision)
  )
    throw new Error(
      "O relatório foi atualizado. Reabra a versão atual antes de imprimir."
    );
  return fresh;
}
