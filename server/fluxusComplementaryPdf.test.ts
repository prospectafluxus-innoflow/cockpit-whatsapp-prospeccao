import { readdir, stat } from "node:fs/promises";
import * as childProcess from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractComplementaryPdf,
  parseComplementaryText,
} from "./fluxusComplementaryPdf";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

const execFileMock = vi.mocked(childProcess.execFile);
const VALID_PDF = Buffer.from("%PDF-1.7\nsynthetic test bytes", "ascii");
const TEMP_PREFIX = "fluxus-complementary-";

type Callback = (error: Error | null, stdout: string, stderr: string) => void;

type ExecCall = {
  command: string;
  args: readonly string[];
  options: { maxBuffer?: number; shell?: boolean; timeout?: number };
};

function configurePoppler(
  text: string,
  pageCount = 2,
  encrypted = false
): void {
  execFileMock.mockImplementation(((
    command: string,
    args: readonly string[],
    options: ExecCall["options"],
    callback: Callback
  ) => {
    if (command === "pdfinfo") {
      callback(
        null,
        `Pages: ${pageCount}\nEncrypted: ${encrypted ? "yes" : "no"}\n`,
        ""
      );
      return;
    }
    callback(null, text, "");
  }) as typeof childProcess.execFile);
}

async function temporaryDirectories(): Promise<string[]> {
  const entries = await readdir("/tmp");
  return entries.filter(entry => entry.startsWith(TEMP_PREFIX));
}

describe("parseComplementaryText", () => {
  it("extrai QP, data e nome somente com assinatura e contexto explícitos", () => {
    const result = parseComplementaryText(
      [
        "Relatório de Avaliação do QP de Pessoa Exemplo.",
        "Data: 11/11/2026",
        "Pontuação QP: 47",
        "Crítica a si mesmo = 8",
        "Crítica os outros = 6",
        "Crítica às circunstâncias = 8",
        "Faixa de referência: 75",
      ].join("\n"),
      "pq"
    );

    expect(result.sourceName).toBe("Pessoa Exemplo");
    expect(result.sourceDate).toBe("2026-11-11");
    expect(result.values.pq).toBe(47);
    expect(result.values.critic).toEqual({});
    expect(result.warnings).not.toContain(
      "Pontuação QP explícita não encontrada; preenchimento manual necessário."
    );
  });

  it("não usa um número genérico como pontuação QP", () => {
    const result = parseComplementaryText(
      "Relatório de Avaliação do QP de Pessoa Exemplo.\nData: 11/11/2026\nO resultado de referência é 75.",
      "pq"
    );

    expect(result.values.pq).toBeNull();
    expect(result.warnings.join(" ")).toMatch(/Pontuação QP explícita/);
  });

  it("prioriza a nota pessoal de 24 horas sobre exemplos posteriores de 50 e 75", () => {
    const text =
      "Relatório de Avaliação do QP\n11/11/2026 11:06:35\fRelatório de Avaliação do QP de Pessoa Exemplo.\nNOTA: Sua Pontuação QP baseada no seu relato das últimas 24 horas é 47 dentro de uma pontuação total possível de 100.\nUm bilionário com pontuação QP de 50 é um exemplo.\nUm QP de 75 é descrito no método.\nSua pontuação é 47.";
    const result = parseComplementaryText(text, "pq");
    expect(result.values.pq).toBe(47);
    expect(result.sourceDate).toBe("2026-11-11");
    const withoutPersonalScore = parseComplementaryText(
      "Relatório de Avaliação do QP de Pessoa Exemplo.\nUm bilionário com pontuação QP de 50 é um exemplo.\nOutro exemplo tem pontuação QP de 80.",
      "pq"
    );
    expect(withoutPersonalScore.values.pq).toBeNull();
  });

  it("aceita o contexto 'é ... dentro ... 100' para QP", () => {
    const result = parseComplementaryText(
      "Pontuação QP\nSeu resultado é47 dentro de uma escala de 0 a 100.",
      "pq"
    );

    expect(result.values.pq).toBe(47);
  });

  it("extrai apenas resultados explícitos de Sabotadores e nunca texto descritivo", () => {
    const result = parseComplementaryText(
      [
        "Relatório de Avaliação dos Sabotadores de Pessoa Exemplo.",
        "Data: 11/11/2026",
        "Hipervigilante: 6,5",
        "Descrição: os meses 8 e 9 foram difíceis; Crítica a si mesmo = 8%.",
      ].join("\n"),
      "saboteurs"
    );

    expect(result.values.pq).toBeNull();
    expect(result.values.saboteurs).toEqual({ hyperVigilant: 6.5 });
    expect(result.values.critic).toEqual({});
    expect(result.warnings.join(" ")).toMatch(/gráfico não foi inferido/);
    expect(result.warnings.join(" ")).toMatch(/Crítica/);
  });

  it("não retorna valores quando a assinatura é de outro modelo", () => {
    const result = parseComplementaryText(
      "Relatório de Avaliação dos Sabotadores de Pessoa Exemplo.\nPontuação QP: 88",
      "pq"
    );

    expect(result.values).toEqual({ pq: null, saboteurs: {}, critic: {} });
    expect(result.sourceName).toBeNull();
    expect(result.warnings.join(" ")).toMatch(/Modelo de relatório/);
  });

  it("rejeita datas impossíveis sem deslocamento de fuso", () => {
    const result = parseComplementaryText(
      "Relatório de Avaliação do QP de Pessoa Exemplo.\nData do relatório: 31/02/2026\nPontuação QP: 47",
      "pq"
    );

    expect(result.sourceDate).toBeNull();
    expect(result.warnings.join(" ")).toMatch(/Data do relatório/);
  });
});

describe("extractComplementaryPdf", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("usa pdfinfo/pdftotext sem shell, respeita limites e remove o temporário", async () => {
    configurePoppler(
      "Relatório de Avaliação do QP de Pessoa Exemplo.\nData: 11/11/2026\nPontuação QP: 47"
    );
    const before = await temporaryDirectories();

    const result = await extractComplementaryPdf(VALID_PDF, "pq");

    const after = await temporaryDirectories();
    expect(result.pageCount).toBe(2);
    expect(result.values.pq).toBe(47);
    expect(after).toEqual(before);
    expect(execFileMock).toHaveBeenCalledTimes(2);
    for (const call of execFileMock.mock.calls) {
      const options = call[2] as ExecCall["options"];
      expect(options.shell).toBe(false);
      expect(options.timeout).toBeGreaterThan(0);
      expect(options.timeout).toBeLessThanOrEqual(10_000);
    }

    const pdftotextCall = execFileMock.mock.calls[1];
    const sourcePath = String(pdftotextCall[1]?.[3]);
    const sourceStat = await stat(sourcePath).catch(() => null);
    expect(sourceStat).toBeNull();
  });

  it("rejeita cabeçalho que não é PDF sem iniciar subprocesso", async () => {
    await expect(
      extractComplementaryPdf(Buffer.from("not a pdf", "ascii"), "pq")
    ).rejects.toThrow(/PDF válido/);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("rejeita PDF cifrado antes de extrair texto e limpa o temporário", async () => {
    configurePoppler("", 2, true);
    const before = await temporaryDirectories();

    await expect(extractComplementaryPdf(VALID_PDF, "pq")).rejects.toThrow(
      /cifrado/
    );

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(await temporaryDirectories()).toEqual(before);
  });

  it("rejeita também o formato cifrado com permissões detalhadas do Poppler", async () => {
    execFileMock.mockImplementation(((
      command: string,
      args: readonly string[],
      options: ExecCall["options"],
      callback: Callback
    ) => {
      callback(null, "Pages: 2\nEncrypted: yes (print:yes copy:yes)\n", "");
    }) as typeof childProcess.execFile);
    await expect(extractComplementaryPdf(VALID_PDF, "pq")).rejects.toThrow(
      /cifrado/
    );
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it("rejeita excesso de páginas", async () => {
    configurePoppler("", 41, false);

    await expect(extractComplementaryPdf(VALID_PDF, "pq")).rejects.toThrow(
      /páginas/
    );
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it("rejeita falha/timeout do subprocesso e ainda remove o temporário", async () => {
    execFileMock.mockImplementation(((
      command: string,
      _args: readonly string[],
      _options: ExecCall["options"],
      callback: Callback
    ) => {
      const error = Object.assign(new Error("timeout"), {
        code: "ETIMEDOUT",
        killed: true,
      });
      callback(error, "", "");
    }) as typeof childProcess.execFile);
    const before = await temporaryDirectories();

    await expect(extractComplementaryPdf(VALID_PDF, "pq")).rejects.toThrow(
      /pdfinfo/
    );
    expect(await temporaryDirectories()).toEqual(before);
  });

  it("rejeita texto maior que 512 KiB", async () => {
    configurePoppler("x".repeat(512 * 1024 + 1));

    await expect(extractComplementaryPdf(VALID_PDF, "pq")).rejects.toThrow(
      /Texto extraído/
    );
  });
});
