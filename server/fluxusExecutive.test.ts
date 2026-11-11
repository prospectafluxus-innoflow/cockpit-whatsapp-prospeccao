import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("./db", () => ({ db: {} }));
vi.mock("./fluxusOrganization", () => ({
  getFluxusDirectTeamUserIds: vi.fn(),
}));
vi.mock("./fluxusDb", () => ({ recordFluxusAudit: vi.fn() }));

import {
  emptyExecutiveNotes,
  executiveNotesSchema,
  executiveSelectionSchema,
} from "../shared/fluxusExecutive";
import { validateNotesScope } from "./fluxusExecutiveDb";

describe("contrato da visão executiva", () => {
  it("normaliza notas vazias sem criar conteúdo consultivo", () => {
    expect(emptyExecutiveNotes()).toEqual({
      title: "",
      audience: "",
      author: "",
      summary: "",
      context: "",
      actions: "",
      individuals: {},
    });
  });

  it("rejeita duplicidade e seleção individual com mais de uma avaliação", () => {
    expect(() =>
      executiveSelectionSchema.parse({
        mode: "team",
        assessmentIds: [4, 4],
      })
    ).toThrow();
    expect(() =>
      executiveSelectionSchema.parse({
        mode: "individual",
        assessmentIds: [4, 5],
      })
    ).toThrow();
  });

  it("aceita ficha individual somente quando a avaliação está selecionada", () => {
    const notes = executiveNotesSchema.parse({
      individuals: {
        "42": { summary: "Conversa", context: "", recommendations: "" },
      },
    });
    expect(() => validateNotesScope(notes, [42, 43])).not.toThrow();
    expect(() => validateNotesScope(notes, [43])).toThrowError(TRPCError);
    try {
      validateNotesScope(notes, [43]);
    } catch (error) {
      expect(error).toMatchObject({ code: "BAD_REQUEST" });
    }
  });
});
