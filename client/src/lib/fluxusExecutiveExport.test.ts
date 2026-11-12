import { describe, expect, it, vi } from "vitest";
import type {
  ExecutivePreviewResponse,
  ExecutiveSelection,
} from "@shared/fluxusExecutive";
import { revalidateExecutiveExport } from "./fluxusExecutiveExport";
const selection: ExecutiveSelection = {
  companyId: 9,
  mode: "individual",
  assessmentIds: [70],
};
function response(): ExecutivePreviewResponse {
  return {
    data: {
      company: { id: 9, name: "Teste" },
      mode: "individual",
      people: [{ assessmentId: 70 } as any],
      minimumRespondents: 5,
      aggregate: null,
      departments: [],
      groupPrivacyNote: "",
      generatedAt: "2026-11-11T12:00:00Z",
    },
    notes: {} as any,
    report: null,
    canEdit: true,
  };
}
describe("exportação com dados revalidados", () => {
  it("usa resposta atual do servidor e não a prévia anterior", async () => {
    const fresh = response();
    const fetchPreview = vi.fn(async () => fresh);
    const fetchSaved = vi.fn();
    expect(
      await revalidateExecutiveExport({ selection, fetchPreview, fetchSaved })
    ).toBe(fresh);
    expect(fetchPreview).toHaveBeenCalledWith(selection);
    expect(fetchSaved).not.toHaveBeenCalled();
  });
  it("falha fechado quando acesso atual é negado", async () => {
    const fetchPreview = vi.fn(async () => {
      throw new Error("Sem acesso");
    });
    await expect(
      revalidateExecutiveExport({
        selection,
        fetchPreview,
        fetchSaved: vi.fn(),
      })
    ).rejects.toThrow("Sem acesso");
  });
  it("impede imprimir outro recorte ou tipo", async () => {
    const fresh = response();
    fresh.data.people = [{ assessmentId: 80 } as any];
    await expect(
      revalidateExecutiveExport({
        selection,
        fetchPreview: async () => fresh,
        fetchSaved: vi.fn(),
      })
    ).rejects.toThrow("seleção mudou");
  });
  it("exige a revisão atual ao imprimir relatório salvo", async () => {
    const fresh = response();
    fresh.report = { id: 4, revision: 3 } as any;
    await expect(
      revalidateExecutiveExport({
        selection,
        reportId: 4,
        revision: 2,
        fetchPreview: vi.fn(),
        fetchSaved: async () => fresh,
      })
    ).rejects.toThrow("atualizado");
    expect(
      await revalidateExecutiveExport({
        selection,
        reportId: 4,
        revision: 3,
        fetchPreview: vi.fn(),
        fetchSaved: async () => fresh,
      })
    ).toBe(fresh);
  });
});
