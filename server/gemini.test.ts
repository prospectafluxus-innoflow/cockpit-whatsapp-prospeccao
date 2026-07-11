/**
 * gemini.test.ts — Valida a integração com a API do Google Gemini quando a
 * respetiva chave está disponível no ambiente de integração.
 */
import { describe, it, expect } from "vitest";

const geminiKey = process.env.GEMINI_API_KEY ?? "";

describe.skipIf(!geminiKey)("Gemini API — validação da chave", () => {
  it("GEMINI_API_KEY tem um formato mínimo plausível", () => {
    expect(geminiKey.length).toBeGreaterThan(10);
  });

  it("chave é reconhecida pela API do Gemini (200 ou 429)", async () => {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Responda apenas: OK" }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });

    // 200 = sucesso, 429 = quota excedida (chave válida, limite atingido).
    // 401/403 = chave inválida ou sem permissão.
    const validCodes = [200, 429];
    expect(validCodes).toContain(response.status);

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      expect(text.length).toBeGreaterThan(0);
    }
  }, 15000);
});
