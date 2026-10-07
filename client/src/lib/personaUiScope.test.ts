import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isPersonaRoute } from "./personaUiScope";

const css = readFileSync("client/src/index.css", "utf8")
  .split("/* Persona: seleção visível")[1]
  .replace(/^[\s\S]*?\*\//, "");

describe("caixas laranja em todas as rotinas do Persona", () => {
  it.each([
    "/fluxus",
    "/fluxus/login",
    "/fluxus/cadastro",
    "/fluxus/avaliacao",
    "/fluxus/relatorio/1",
    "/fluxus/privacidade",
    "/fluxus/admin",
    "/fluxus/admin/empresa/1",
    "/fluxus/feedback",
    "/fluxus/feedback/ciclo/4",
    "/fluxus/feedback/avaliacao/1",
    "/fluxus/feedback/historico",
    "/fluxus?section=organization",
    "/fluxus/admin/empresa/1#papeis-de-acesso",
  ])("ativa o escopo em %s", pathname => {
    expect(isPersonaRoute(pathname)).toBe(true);
  });
  it.each([
    "/",
    "/admin",
    "/login",
    "/profile",
    "/cockpit",
    "/fluxus-outro",
    "/outro/fluxus",
  ])("não muda o estilo fora do Persona em %s", pathname => {
    expect(isPersonaRoute(pathname)).toBe(false);
  });
  it("cobre componentes, inputs nativos e portais, sem mostrar inputs ocultos", () => {
    expect(css).toContain('[data-slot="checkbox"]');
    expect(css).toContain('input[type="checkbox"]:not([aria-hidden="true"])');
    const selectors = Array.from(
      css.matchAll(/(?:^|\})\s*([^{}]+)\{/g),
      match => match[1].trim()
    );
    expect(selectors.length).toBeGreaterThan(4);
    expect(
      selectors.every(selector =>
        selector.startsWith('body[data-persona-ui="true"]')
      )
    ).toBe(true);
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toContain('document.body.dataset.personaUi = "true"');
    expect(app).toContain("delete document.body.dataset.personaUi");
  });
  it("mantém contorno visível, preenchimento, marca, foco e disabled sem desaparecer", () => {
    expect(css).toContain("width: 20px");
    expect(css).toContain("border: 2px solid #fb923c");
    expect(css).toContain('data-state="checked"');
    expect(css).toContain('data-state="indeterminate"');
    expect(css).toContain("background-color: #fb923c");
    expect(css).toContain("background-image: url(");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline: 3px solid #fdba74");
    expect(css).toContain(":disabled");
    expect(css).toContain("border-style: dashed");
    expect(css).not.toMatch(/opacity:\s*0(?:[.;\s])/);
  });
  it("laranja e marca têm contraste de pelo menos 3:1 sobre seus fundos", () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5]
        .map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
        .map(value =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        );
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (a: string, b: string) =>
      (Math.max(luminance(a), luminance(b)) + 0.05) /
      (Math.min(luminance(a), luminance(b)) + 0.05);
    expect(contrast("#fb923c", "#1f130b")).toBeGreaterThanOrEqual(3);
    expect(contrast("#fb923c", "#171717")).toBeGreaterThanOrEqual(3);
  });
});
