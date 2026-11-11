import { describe, expect, it } from "vitest";
import {
  emptyExecutiveNotes,
  type ExecutiveSelection,
} from "@shared/fluxusExecutive";
import { buildExecutiveSavePayload } from "./FluxusExecutivePage";

/** Fixture sintético: IDs e notas não representam dados reais. */
const syntheticSelection: ExecutiveSelection = {
  companyId: 991,
  mode: "individual",
  assessmentIds: [710],
};

describe("FluxusExecutivePage save payload", () => {
  it("envia seleção aninhada, notas e revisão esperada ao backend", () => {
    const notes = emptyExecutiveNotes();
    notes.title = "Relatório sintético";
    notes.summary = "Síntese sintética para teste";

    const payload = buildExecutiveSavePayload(syntheticSelection, notes, 42, 3);

    expect(payload).toEqual({
      selection: syntheticSelection,
      notes,
      reportId: 42,
      expectedRevision: 3,
    });
    expect(payload).not.toHaveProperty("mode");
    expect(payload).not.toHaveProperty("assessmentIds");
  });

  it("omite revisionamento quando a prévia ainda não foi salva", () => {
    const payload = buildExecutiveSavePayload(
      syntheticSelection,
      emptyExecutiveNotes()
    );

    expect(payload).toEqual({
      selection: syntheticSelection,
      notes: emptyExecutiveNotes(),
    });
  });
});
