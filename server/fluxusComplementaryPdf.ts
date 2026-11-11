import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COMPLEMENTARY_MAX_PDF_BYTES,
  emptyComplementaryValues,
  type ComplementaryKind,
  type ComplementaryValues,
} from "../shared/fluxusComplementary";

const MAX_PAGES = 40;
const MAX_TEXT_BYTES = 512 * 1024;
const POPPLER_TIMEOUT_MS = 10_000;
const TEMP_DIR_MODE = 0o700;
const TEMP_FILE_MODE = 0o600;

const MODEL_WARNING =
  "Modelo de relatório não reconhecido para o tipo solicitado.";
const DATE_WARNING = "Data do relatório não encontrada ou inválida.";
const NAME_WARNING = "Nome do titular não encontrado no título do relatório.";
const PQ_WARNING =
  "Pontuação QP explícita não encontrada; preenchimento manual necessário.";
const SABOTEUR_WARNING =
  "Pontuações dos Sabotadores não aparecem como resultados explícitos no texto; o gráfico não foi inferido e o preenchimento manual é necessário.";
const CRITIC_WARNING =
  "Resultados de Crítica explícitos não encontrados; preenchimento manual necessário.";
const TEXT_WARNING = "Texto extraído excede o limite permitido.";

export type ParsedComplementaryText = {
  sourceName: string | null;
  sourceDate: string | null;
  values: ComplementaryValues;
  warnings: string[];
};

export type ExtractedComplementaryPdf = ParsedComplementaryText & {
  pageCount: number;
};

type ExecOutput = {
  stdout: string;
  stderr: string;
};

function runExecFile(
  command: string,
  args: string[],
  timeoutMs: number,
  maxBuffer: number
): Promise<ExecOutput> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        encoding: "utf8",
        maxBuffer,
        shell: false,
        timeout: timeoutMs,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          stdout: typeof stdout === "string" ? stdout : String(stdout),
          stderr: typeof stderr === "string" ? stderr : String(stderr),
        });
      }
    );
  });
}

function asSafeCommandError(command: string): Error {
  return new Error(`Não foi possível extrair texto do PDF com ${command}.`);
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\u00a0/g, " ");
}

function compactForMatch(value: string): string {
  return normalizeForMatch(value).replace(/\s+/g, " ").trim();
}

function uniqueWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function parseFiniteNumber(raw: string): number | null {
  const normalized = raw.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function isRealDate(day: number, month: number, year: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function extractReportDate(text: string): string | null {
  const normalized = normalizeForMatch(text);
  // O modelo NoviSurvey traz a data com hora na capa, sem rótulo.
  const cover = normalized.split("\f")[0].slice(0, 1600);
  const coverDate = cover.match(
    /^\s*(\d{2})\/(\d{2})\/(\d{4})[ \t]+\d{1,2}:\d{2}:\d{2}\s*$/m
  );
  if (
    coverDate &&
    /relatorio de avaliacao/.test(cover) &&
    isRealDate(Number(coverDate[1]), Number(coverDate[2]), Number(coverDate[3]))
  ) {
    return `${coverDate[3]}-${coverDate[2]}-${coverDate[1]}`;
  }
  const datePattern =
    /\b(?:data(?:\s+(?:do|da)\s+(?:relatorio|avaliacao|questionario|teste))?|data\s+de\s+(?:avaliacao|realizacao|conclusao)|gerado\s+em|emitido\s+em)\s*[:\-]?\s*(\d{2})\/(\d{2})\/(\d{4})/gi;

  let match: RegExpExecArray | null;
  while ((match = datePattern.exec(normalized)) !== null) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (isRealDate(day, month, year)) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function isLikelyPersonName(candidate: string): boolean {
  const name = candidate.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) return false;
  const words = name.split(" ");
  if (words.length > 12) return false;
  return words.every(word =>
    /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(word)
  );
}

function extractReportName(text: string): string | null {
  const titleText = text.replace(/\s+/g, " ").trim();
  const titlePattern =
    /relat[oó]rio\s+de\s+avalia[cç][aã]o\s+(?:do\s+qp|dos\s+sabotadores)\s+de\s+([^\.]{1,120}?)\s*\.(?=\s|$)/i;
  const titleMatch = titleText.match(titlePattern);
  if (titleMatch && isLikelyPersonName(titleMatch[1])) {
    return titleMatch[1].trim().replace(/[\s.]+$/, "");
  }

  const normalizedLines = text.replace(/\r\n?/g, "\n").split("\n");
  const linePattern =
    /relat[oó]rio\s+de\s+avalia[cç][aã]o\s+(?:do\s+qp|dos\s+sabotadores)\s+de\s+([^\.\r\n]{1,120})\s*\.?$/i;
  for (const line of normalizedLines) {
    const lineMatch = line.match(linePattern);
    if (lineMatch && isLikelyPersonName(lineMatch[1])) {
      return lineMatch[1].trim().replace(/[\s.]+$/, "");
    }
  }

  return null;
}

function extractQpScore(text: string): number | null {
  const normalized = compactForMatch(text);
  const number = `(\\d{1,3}(?:[.,]\\d{1,2})?)`;
  const patterns = [
    // Priorizar o resultado pessoal da nota, não exemplos de QP 50/75 do livro.
    new RegExp(
      `\\b(?:sua pontuacao(?:\\s+qp)?|seu resultado)\\b.{0,180}?\\be\\s*${number}(?![\\d.,])(?=\\s+dentro[^.]{0,100}\\b100\\b)`,
      "i"
    ),
    new RegExp(
      `\\bsua pontuacao(?:\\s+qp)?\\s*(?:e|:|=)\\s*${number}(?![\\d.,])`,
      "i"
    ),
    new RegExp(`\\bpontuacao qp\\s*(?::|=)\\s*${number}(?![\\d.,])`, "i"),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const value = parseFiniteNumber(match[1]);
    if (value !== null && value >= 0 && value <= 100) return value;
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findExplicitLineScore(
  line: string,
  labelPattern: string,
  minimum: number,
  maximum: number
): number | null {
  const scorePattern = new RegExp(
    `(?:^|[^\\p{L}])${labelPattern}[ \\t]*(?::|=)[ \\t]*(\\d{1,2}(?:[.,]\\d{1,2})?)(?![\\d.,])`,
    "iu"
  );
  const match = line.match(scorePattern);
  if (!match || match.index === undefined) return null;

  const afterMatch = line.slice(match.index + match[0].length);
  if (/^[ \t]*%/.test(afterMatch)) return null;

  const value = parseFiniteNumber(match[1]);
  if (value === null || value < minimum || value > maximum) return null;
  return value;
}

function extractSaboteurScores(text: string): ComplementaryValues["saboteurs"] {
  const labels = {
    stickler: "insistente",
    pleaser: "prestativo",
    hyperVigilant: "hipervigilante",
    restless: "inquieto",
    controller: "controlador",
    avoider: "esquivo",
    hyperAchiever: "hiper-realizador",
    victim: "vitima",
    hyperRational: "hiper-racional",
  } as const;
  const values: ComplementaryValues["saboteurs"] = {};
  const lines = normalizeForMatch(text).replace(/\r\n?/g, "\n").split("\n");

  for (const [key, label] of Object.entries(labels) as Array<
    [keyof typeof labels, (typeof labels)[keyof typeof labels]]
  >) {
    const score = lines
      .map(line => findExplicitLineScore(line, escapeRegExp(label), 0, 10))
      .find((value): value is number => value !== null);
    if (score !== undefined) values[key] = score;
  }

  return values;
}

function extractCriticScores(text: string): ComplementaryValues["critic"] {
  const labels: Record<keyof ComplementaryValues["critic"], string> = {
    self: "critica\\s+a\\s+si\\s+mesmo",
    others: "critica\\s+(?:aos?|os)\\s+outros",
    circumstances: "critica\\s+as\\s+circunstancias",
  };
  const values: ComplementaryValues["critic"] = {};
  const lines = normalizeForMatch(text).replace(/\r\n?/g, "\n").split("\n");

  for (const [key, labelPattern] of Object.entries(labels) as Array<
    [keyof typeof labels, string]
  >) {
    const score = lines
      .map(line => findExplicitLineScore(line, labelPattern, 1, 15))
      .find((value): value is number => value !== null);
    if (score !== undefined) values[key] = score;
  }

  return values;
}

function hasExpectedModel(text: string, kind: ComplementaryKind): boolean {
  const normalized = compactForMatch(text);
  const hasQpSignature =
    normalized.includes("relatorio de avaliacao do qp") ||
    normalized.includes("pontuacao qp");
  const hasSaboteurSignature = normalized.includes(
    "relatorio de avaliacao dos sabotadores"
  );

  if (kind === "pq") return hasQpSignature && !hasSaboteurSignature;
  return hasSaboteurSignature && !hasQpSignature;
}

function parsePageCount(pdfInfo: string): number | null {
  const match = pdfInfo.match(/^\s*pages\s*:\s*(\d+)\s*$/im);
  if (!match) return null;
  const pageCount = Number(match[1]);
  return Number.isSafeInteger(pageCount) && pageCount > 0 ? pageCount : null;
}

function isEncryptedPdfInfo(pdfInfo: string): boolean {
  return /^\s*encrypted\s*:\s*yes(?:\s|$)/im.test(pdfInfo);
}

export function parseComplementaryText(
  text: string,
  kind: ComplementaryKind
): ParsedComplementaryText {
  const values = emptyComplementaryValues();
  const warnings: string[] = [];

  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
    uniqueWarning(warnings, TEXT_WARNING);
    return { sourceName: null, sourceDate: null, values, warnings };
  }

  if (!hasExpectedModel(text, kind)) {
    uniqueWarning(warnings, MODEL_WARNING);
    return { sourceName: null, sourceDate: null, values, warnings };
  }

  const sourceName = extractReportName(text);
  const sourceDate = extractReportDate(text);
  if (!sourceName) uniqueWarning(warnings, NAME_WARNING);
  if (!sourceDate) uniqueWarning(warnings, DATE_WARNING);

  if (kind === "pq") {
    values.pq = extractQpScore(text);
    if (values.pq === null) uniqueWarning(warnings, PQ_WARNING);
  } else {
    values.critic = extractCriticScores(text);
    if (Object.keys(values.critic).length === 0)
      uniqueWarning(warnings, CRITIC_WARNING);
    values.saboteurs = extractSaboteurScores(text);
    if (Object.keys(values.saboteurs).length === 0) {
      uniqueWarning(warnings, SABOTEUR_WARNING);
    } else if (Object.keys(values.saboteurs).length < 9) {
      uniqueWarning(warnings, SABOTEUR_WARNING);
    }
  }

  return { sourceName, sourceDate, values, warnings };
}

let activeExtractions = 0;

export async function extractComplementaryPdf(
  pdf: Buffer,
  kind: ComplementaryKind
): Promise<ExtractedComplementaryPdf> {
  if (!Buffer.isBuffer(pdf) || pdf.length === 0) {
    throw new Error("PDF vazio ou inválido.");
  }
  if (pdf.length > COMPLEMENTARY_MAX_PDF_BYTES) {
    throw new Error("PDF excede o limite de tamanho permitido.");
  }
  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Arquivo não é um PDF válido.");
  }
  if (activeExtractions >= 2)
    throw new Error("Há PDFs sendo processados. Aguarde e tente novamente.");
  activeExtractions++;

  let temporaryDirectory: string | null = null;
  const startedAt = Date.now();
  const remainingTimeout = (): number =>
    Math.max(
      1,
      Math.min(
        POPPLER_TIMEOUT_MS,
        POPPLER_TIMEOUT_MS - (Date.now() - startedAt)
      )
    );

  try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "fluxus-complementary-"));
    await chmod(temporaryDirectory, TEMP_DIR_MODE);
    const pdfPath = join(temporaryDirectory, "input.pdf");
    await writeFile(pdfPath, pdf, { flag: "wx", mode: TEMP_FILE_MODE });
    await chmod(pdfPath, TEMP_FILE_MODE);

    let pdfInfo: ExecOutput;
    try {
      pdfInfo = await runExecFile(
        "pdfinfo",
        [pdfPath],
        remainingTimeout(),
        64 * 1024
      );
    } catch {
      throw asSafeCommandError("pdfinfo");
    }

    if (isEncryptedPdfInfo(pdfInfo.stdout)) {
      throw new Error("PDF cifrado não é aceito nesta rotina.");
    }

    const pageCount = parsePageCount(pdfInfo.stdout);
    if (pageCount === null) {
      throw new Error(
        "Não foi possível validar a quantidade de páginas do PDF."
      );
    }
    if (pageCount > MAX_PAGES) {
      throw new Error("PDF excede o limite de páginas permitido.");
    }

    let textOutput: ExecOutput;
    try {
      textOutput = await runExecFile(
        "pdftotext",
        ["-layout", "-enc", "UTF-8", pdfPath, "-"],
        remainingTimeout(),
        MAX_TEXT_BYTES
      );
    } catch {
      throw asSafeCommandError("pdftotext");
    }

    const text = textOutput.stdout;
    if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
      throw new Error("Texto extraído excede o limite permitido.");
    }

    return { ...parseComplementaryText(text, kind), pageCount };
  } finally {
    try {
      if (temporaryDirectory)
        await rm(temporaryDirectory, { recursive: true, force: true });
    } finally {
      activeExtractions--;
    }
  }
}
