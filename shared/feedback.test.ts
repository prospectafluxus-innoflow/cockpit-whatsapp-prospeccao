import { describe, expect, it } from "vitest";
import {
  FEEDBACK_COMPETENCIES,
  FEEDBACK_METHOD_VERSION,
  FEEDBACK_TRANSITIONS,
  CYCLE_TRANSITIONS,
  competencySnapshot,
  competencyIdsSchema,
  classifyFeedback,
  calculateFeedback,
  validateFeedbackItems,
  consolidateFeedback,
  isFeedbackVisibleToParticipant,
  FEEDBACK_ACKNOWLEDGEMENT,
  type FeedbackHistoryEntry,
  type FeedbackItem,
} from "./feedback";

const snapshot = competencySnapshot(FEEDBACK_COMPETENCIES.map(c => c.id));
const items = (score: number | null = 5): FeedbackItem[] =>
  snapshot.map(c => ({
    competencyId: c.id,
    score,
    evidence: "Entrega documentada no período",
    effect: "Atendimento no prazo combinado",
    advice: "Manter rotina e acompanhamento",
    notes: "",
  }));
function entry(
  id: number,
  status: FeedbackHistoryEntry["status"] = "closed",
  score = 5
): FeedbackHistoryEntry {
  return {
    id,
    cycleId: id,
    cycleName: `C${id}`,
    cycleStart: `2027-${String(id * 3 - 2).padStart(2, "0")}-01`,
    cycleEnd: `2027-${String(id * 3).padStart(2, "0")}-28`,
    cycleStatus: "closed",
    status,
    methodVersion: FEEDBACK_METHOD_VERSION,
    competencies: snapshot,
    items: items(score),
  };
}

describe("catálogo de Feedback EEC", () => {
  it("tem dez competências estáveis com definições e responsabilidade", () => {
    expect(snapshot).toHaveLength(10);
    expect(new Set(snapshot.map(c => c.id)).size).toBe(10);
    expect(snapshot.find(c => c.id === "accountability")?.name).toBe(
      "Responsabilidade e Compromisso"
    );
    expect(snapshot.every(c => c.definition.length > 20)).toBe(true);
  });
  it("limita disponibilidade à jornada", () =>
    expect(snapshot.find(c => c.id === "availability")!.definition).toContain(
      "jornada"
    ));
  it("rejeita catálogo livre, seleção vazia e duplicação", () => {
    expect(competencyIdsSchema.safeParse([]).success).toBe(false);
    expect(competencyIdsSchema.safeParse(["nova-competencia"]).success).toBe(
      false
    );
    expect(competencyIdsSchema.safeParse(["quality", "quality"]).success).toBe(
      false
    );
  });
  it("cria cópia do snapshot e mantém a ordem escolhida", () => {
    const copy = competencySnapshot(["quality", "productivity"]);
    copy[0]!.name = "Alterado";
    expect(FEEDBACK_COMPETENCIES.find(c => c.id === "quality")!.name).toBe(
      "Qualidade das Entregas"
    );
    expect(copy.map(c => c.id)).toEqual(["quality", "productivity"]);
  });
});

describe("escala e cálculo padronizados", () => {
  it.each([
    [0, "development"],
    [1, "development"],
    [2, "development"],
    [3, "development"],
    [4, "constructive"],
    [5, "constructive"],
    [6, "positive"],
  ] as const)("classifica %i como %s", (score, label) =>
    expect(classifyFeedback(score)).toBe(label)
  );
  it.each([-1, 7, 3.5, NaN, Infinity])("não aceita nota inválida %s", score =>
    expect(() => classifyFeedback(score)).toThrow()
  );
  it.each([1, 6, 8, 9, 10])("referência ajustada para %i competências", n => {
    const result = calculateFeedback(items(5).slice(0, n), n);
    expect(result).toMatchObject({
      obtained: n * 5,
      expected: n * 5,
      maximum: n * 6,
      difference: 0,
      average: 5,
      complete: true,
    });
  });
  it("não confunde zero com ausência de nota", () => {
    const result = calculateFeedback(
      [
        { ...items()[0]!, score: 0 },
        { ...items()[1]!, score: null },
      ],
      2
    );
    expect(result).toMatchObject({
      obtained: 0,
      scoredCount: 1,
      complete: false,
      difference: null,
      average: 0,
    });
    expect(calculateFeedback([], 2).average).toBeNull();
  });
  it("preserva sentido esperado menos obtido", () =>
    expect(calculateFeedback(items(6), 10).difference).toBe(-10));
  it.each([0, 11, -1, 1.5])("não aceita quantidade %s", n =>
    expect(() => calculateFeedback([], n)).toThrow()
  );
  it("não permite itens duplicados no cálculo", () =>
    expect(() => calculateFeedback([items()[0]!, items()[0]!], 2)).toThrow());
});

describe("EEC e liberação", () => {
  it("permite rascunho sem nota ou textos", () =>
    expect(
      validateFeedbackItems(
        [
          {
            competencyId: "quality",
            score: null,
            evidence: "",
            effect: "",
            advice: "",
            notes: "",
          },
        ],
        snapshot
      )
    ).toHaveLength(1));
  it("exige todas competências ao concluir", () =>
    expect(() =>
      validateFeedbackItems(items().slice(0, 9), snapshot, true)
    ).toThrow());
  it.each(["evidence", "effect", "advice"] as const)(
    "exige %s inclusive em notas positivas",
    field => {
      const list = items(6);
      list[0]![field] = " ";
      expect(() => validateFeedbackItems(list, snapshot, true)).toThrow();
    }
  );
  it("aceita nota zero completa e faz trim dos textos", () => {
    const list = items(0);
    list[0]!.evidence = "  Fato registrado  ";
    expect(validateFeedbackItems(list, snapshot, true)[0]!.evidence).toBe(
      "Fato registrado"
    );
  });
  it("rejeita duplicação e competência fora do ciclo", () => {
    expect(() =>
      validateFeedbackItems([items()[0]!, items()[0]!], snapshot)
    ).toThrow();
    expect(() =>
      validateFeedbackItems(
        [{ ...items()[0]!, competencyId: "inventada" }],
        snapshot
      )
    ).toThrow();
  });
  it("não permite pular da conclusão para liberação", () => {
    expect(FEEDBACK_TRANSITIONS.draft).toEqual(["completed"]);
    expect(FEEDBACK_TRANSITIONS.completed).not.toContain("released");
    expect(FEEDBACK_TRANSITIONS.debriefed).toEqual(["released"]);
    expect(FEEDBACK_TRANSITIONS.released).toEqual(["acknowledged"]);
    expect(CYCLE_TRANSITIONS.closed).toEqual([]);
  });
  it.each(["draft", "completed", "debriefed"] as const)(
    "oculta %s do participante",
    status => expect(isFeedbackVisibleToParticipant(status)).toBe(false)
  );
  it.each(["released", "acknowledged", "closed"] as const)(
    "libera %s ao participante",
    status => expect(isFeedbackVisibleToParticipant(status)).toBe(true)
  );
  it("ciência não é concordância nem renúncia", () =>
    expect(FEEDBACK_ACKNOWLEDGEMENT).toContain(
      "Não significa concordância integral nem renúncia"
    ));
});

describe("histórico e consolidação", () => {
  it("consolida quatro ciclos sem criar quinta avaliação", () => {
    const result = consolidateFeedback(
      [entry(4), entry(2), entry(1), entry(3)],
      4
    );
    expect(result).toMatchObject({
      completedCycles: 4,
      obtained: 200,
      expected: 200,
      maximum: 240,
      partial: false,
      comparable: true,
    });
    expect(result.cycles.map(c => c.cycleName)).toEqual([
      "C1",
      "C2",
      "C3",
      "C4",
    ]);
  });
  it("não conta pendências ou cancelados como nota zero", () => {
    const cancelled = { ...entry(3), cycleStatus: "cancelled" as const };
    const result = consolidateFeedback(
      [entry(1), entry(2, "draft"), cancelled],
      4
    );
    expect(result).toMatchObject({
      completedCycles: 1,
      obtained: 50,
      expected: 50,
      maximum: 60,
      partial: true,
    });
  });
  it("zero real continua sendo resultado concluído", () =>
    expect(consolidateFeedback([entry(1, "closed", 0)]).completedCycles).toBe(
      1
    ));
  it("modelo de nove não é equivalente a dez", () => {
    const old = {
      ...entry(1),
      competencies: snapshot.slice(0, 9),
      items: items().slice(0, 9),
    };
    const result = consolidateFeedback([old, entry(2)]);
    expect(result.comparable).toBe(false);
    expect(
      result.competencies.find(c => c.competencyId === "accountability")!
        .records
    ).toHaveLength(1);
  });
  it("reordenação não muda a comparabilidade", () =>
    expect(
      consolidateFeedback([
        entry(1),
        { ...entry(2), competencies: [...snapshot].reverse() },
      ]).comparable
    ).toBe(true));
  it("versão ou definição diferente impede comparação indevida", () => {
    const changed = { ...entry(2), methodVersion: "innoflow-eec-2.0" };
    const result = consolidateFeedback([entry(1), changed]);
    expect(result.comparable).toBe(false);
    expect(
      result.competencies.every(c => !c.comparable && c.delta === null)
    ).toBe(true);
  });
  it("evolução mantém ligação com EEC e avaliação", () => {
    const result = consolidateFeedback([
      entry(1, "closed", 3),
      entry(2, "closed", 5),
    ]);
    expect(result.competencies[0]!.delta).toBe(2);
    expect(result.competencies[0]!.records[0]).toMatchObject({
      feedbackId: 1,
      score: 3,
      evidence: "Entrega documentada no período",
    });
  });
});
