import { describe, expect, it } from "vitest";
import { feedbackAvailabilityMessage } from "./feedbackAvailability";

describe("Estado verdadeiro do acesso ao Feedback", () => {
  it("módulo desligado não é descrito como ativo", () => {
    const message = feedbackAvailabilityMessage({
      moduleEnabled: false,
      unavailableReason: "module_disabled",
    });
    expect(message.title).toBe("Feedback desativado neste ambiente");
    expect(message.description).not.toContain("está ativo");
  });
  it("sem membership informa falta de acesso, não falta de habilitação", () => {
    const message = feedbackAvailabilityMessage({
      moduleEnabled: true,
      unavailableReason: "membership_required",
    });
    expect(message.title).toBe(
      "Seu acesso ao Feedback ainda não foi configurado"
    );
    expect(message.description).toContain("O módulo está ativo");
    expect(message.nextStep).toContain("defina o administrador");
    expect(message.nextStep).toContain("não libera notas");
  });
  it("sem empresa orienta o acesso do colaborador sem liberar dados", () => {
    const message = feedbackAvailabilityMessage({
      moduleEnabled: true,
      unavailableReason: "company_missing",
    });
    expect(message.title).toBe("Conta sem empresa vinculada");
    expect(message.nextStep).toContain("acesso de colaborador");
  });
  it("resposta antiga não permite presumir que o módulo está ativo", () => {
    expect(feedbackAvailabilityMessage({}).description).not.toContain(
      "O módulo está ativo"
    );
  });
});
