import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("client/src/index.css", "utf8");
const print = css
  .split('@media print {\n  body[data-persona-executive-report="true"] {')[1]!
  .split("}")[0];

describe("escopo completo de página da impressão executiva", () => {
  it("inclui o body na mesma página nomeada do documento, sem folhas auto antes ou depois", () => {
    expect(print).toContain("page: persona-executive");
    expect(print).toContain("margin: 0 !important");
    expect(print).toContain("padding: 0 !important");
  });
  it("mantém o papel horizontal nomeado e o escopo de Feedback separado", () => {
    expect(css).toContain("@page persona-executive {\n  size: A4 landscape;");
    expect(css).toContain('body[data-feedback-report="true"]');
    const complementary = readFileSync(
      "client/src/components/fluxus/FluxusExecutiveComplementary.css",
      "utf8"
    );
    expect(complementary).toContain(
      "body:not(.persona-executive-print-revalidated)"
    );
  });
});
