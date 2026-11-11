import { describe, expect, it } from "vitest";
import {
  COMPLEMENTARY_TERMS_VERSION,
  SABOTEUR_LABELS,
  CRITIC_LABELS,
  complementaryConsentText,
  emptyComplementaryValues,
} from "./fluxusComplementary";
describe("consentimento das avaliações complementares", () => {
  it("não concede leitores quando ninguém foi escolhido", () => {
    const text = complementaryConsentText([]);
    expect(text).toContain("nenhum outro leitor — somente você");
    expect(text).toContain(
      "ser gestor ou administrador não concede acesso automático"
    );
    expect(text).toContain("sem prejuízo");
    expect(text).toContain(COMPLEMENTARY_TERMS_VERSION);
  });
  it("identifica exatamente os destinatários e o uso permitido", () => {
    const text = complementaryConsentText([
      { id: 7, name: "Consultora Exemplo", roleLabel: "Consultoria" },
    ]);
    expect(text).toContain("Consultora Exemplo (Consultoria)");
    expect(text).toContain("não serão somados");
    expect(text).toContain("diagnóstico");
    expect(text).toContain("retirar");
    expect(text).toContain("Nenhum PDF será enviado a serviço externo de IA");
  });
  it("não inventa valores zero para relatórios ou campos ausentes", () => {
    expect(emptyComplementaryValues()).toEqual({
      pq: null,
      saboteurs: {},
      critic: {},
    });
    expect(Object.keys(SABOTEUR_LABELS)).toHaveLength(9);
    expect(Object.keys(CRITIC_LABELS)).toHaveLength(3);
  });
});
