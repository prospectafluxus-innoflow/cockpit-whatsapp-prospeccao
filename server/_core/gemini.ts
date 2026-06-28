/**
 * gemini.ts — Helper de IA via Google AI Studio (Gemini API)
 *
 * Usa a API REST do Gemini diretamente com fetch nativo.
 * Compatível com chaves do Google AI Studio (começam com AIza... ou AQ...)
 *
 * Requer: GEMINI_API_KEY no ambiente
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Modelo padrão — Gemini 2.0 Flash (gratuito, rápido, ótimo para português)
const DEFAULT_MODEL = "gemini-2.0-flash";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

/**
 * Converte mensagens no formato OpenAI para o formato Gemini.
 */
function toGeminiContents(messages: LLMMessage[]) {
  const systemMessages = messages.filter((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  const systemInstruction =
    systemMessages.length > 0
      ? { parts: [{ text: systemMessages.map((m) => m.content).join("\n") }] }
      : undefined;

  const contents = otherMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  return { systemInstruction, contents };
}

/**
 * Invoca o Gemini via Google AI Studio REST API.
 * Interface compatível com invokeLLM() do Manus.
 */
export async function invokeGemini(opts: {
  messages: LLMMessage[];
  model?: string;
}): Promise<LLMResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Obtenha sua chave em https://aistudio.google.com/app/apikey"
    );
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const { systemInstruction, contents } = toGeminiContents(opts.messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }>; role?: string };
    }>;
  };

  // Normaliza para o formato OpenAI-like que o resto do código espera
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: text,
        },
      },
    ],
  };
}

/**
 * Alias compatível com invokeLLM do Manus.
 * Use este nas procedures tRPC.
 */
export const invokeLLM = invokeGemini;
