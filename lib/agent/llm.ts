/**
 * Capa de IA, aislada en un solo archivo a propósito.
 *
 * En el pitch se afirma que "cambiar el proveedor es cambiar un archivo". Este es el
 * archivo. Si esa frase se va a decir frente al ingeniero de IA del banco, tiene que
 * ser demostrable.
 *
 * Primario: Gemini Flash (tier gratuito de AI Studio). Ver
 * docs/contexto/03-seleccion-modelo-llm.md.
 *
 * Nota: se usa la API REST con fetch en vez del SDK para no agregar una dependencia
 * nueva al lockfile, que es justo lo que genera conflictos entre las laptops del equipo.
 */

export interface MensajeLlm {
  rol: "cliente" | "agente" | "tool";
  texto: string;
  /** Presente cuando el turno del agente pidió ejecutar herramientas. */
  llamadasTool?: readonly LlamadaTool[];
  /** Presente cuando el turno es el resultado de una herramienta. */
  resultadoTool?: { nombre: string; salida: Record<string, unknown> };
}

export interface DeclaracionTool {
  nombre: string;
  descripcion: string;
  /** JSON Schema de los parámetros. */
  parametros: Record<string, unknown>;
}

export interface LlamadaTool {
  nombre: string;
  argumentos: Record<string, unknown>;
}

export interface PeticionLlm {
  systemPrompt: string;
  contexto: string;
  historial: readonly MensajeLlm[];
  tools: readonly DeclaracionTool[];
  /** Nota del validador cuando se está reintentando tras un rechazo. */
  notaCorrectiva?: string;
}

export interface RespuestaLlm {
  texto: string;
  llamadasTool: readonly LlamadaTool[];
  tokensIn: number | null;
  tokensOut: number | null;
  modeloVersion: string;
  truncada: boolean;
}

export interface LlmProvider {
  readonly nombre: string;
  readonly modeloVersion: string;
  generar(peticion: PeticionLlm): Promise<RespuestaLlm>;
}

/** Recomendación explícita del ingeniero de IA del banco (0 a 0.2). */
const TEMPERATURE = 0.2;
/** Fuerza respuestas de 2–3 frases, que además son mejores. */
const MAX_OUTPUT_TOKENS = 200;
const TIMEOUT_MS = 10_000;

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
}

interface GeminiRespuesta {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

function crearGeminiProvider(): LlmProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  // El modelo exacto del tier gratuito se configura por env: los Flash entran en el
  // tier gratuito y los Pro pasaron a ser de pago. Confirmar en AI Studio.
  const modelo = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  return {
    nombre: "gemini",
    modeloVersion: modelo,

    async generar(peticion: PeticionLlm): Promise<RespuestaLlm> {
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY no está configurada. Ver .env.example.");
      }

      const systemInstruction = [peticion.systemPrompt, peticion.contexto]
        .concat(peticion.notaCorrectiva ? [`## CORRECCIÓN\n${peticion.notaCorrectiva}`] : [])
        .join("\n\n");

      const contents = peticion.historial.map((m) => {
        if (m.rol === "tool" && m.resultadoTool) {
          return {
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: m.resultadoTool.nombre,
                  response: m.resultadoTool.salida,
                },
              },
            ],
          };
        }
        if (m.rol === "agente" && m.llamadasTool && m.llamadasTool.length > 0) {
          const parts: GeminiPart[] = m.llamadasTool.map((ll) => ({
            functionCall: { name: ll.nombre, args: ll.argumentos },
          }));
          if (m.texto.length > 0) parts.unshift({ text: m.texto });
          return { role: "model", parts };
        }
        return {
          role: m.rol === "cliente" ? "user" : "model",
          parts: [{ text: m.texto }],
        };
      });

      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      };

      if (peticion.tools.length > 0) {
        body.tools = [
          {
            functionDeclarations: peticion.tools.map((t) => ({
              name: t.nombre,
              description: t.descripcion,
              parameters: t.parametros,
            })),
          },
        ];
      }

      const controlador = new AbortController();
      const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(body),
            signal: controlador.signal,
          },
        );

        if (!res.ok) {
          const detalle = await res.text().catch(() => "");
          throw new Error(`Gemini respondió ${res.status}: ${detalle.slice(0, 300)}`);
        }

        const datos = (await res.json()) as GeminiRespuesta;
        const candidato = datos.candidates?.[0];
        const partes = candidato?.content?.parts ?? [];

        const texto = partes
          .map((p) => p.text ?? "")
          .join("")
          .trim();

        const llamadasTool: LlamadaTool[] = partes
          .filter((p): p is GeminiPart & { functionCall: { name: string; args?: Record<string, unknown> } } =>
            p.functionCall !== undefined,
          )
          .map((p) => ({ nombre: p.functionCall.name, argumentos: p.functionCall.args ?? {} }));

        return {
          texto,
          llamadasTool,
          tokensIn: datos.usageMetadata?.promptTokenCount ?? null,
          tokensOut: datos.usageMetadata?.candidatesTokenCount ?? null,
          modeloVersion: modelo,
          truncada: candidato?.finishReason === "MAX_TOKENS",
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function obtenerLlmProvider(): LlmProvider {
  const nombre = process.env.LLM_PROVIDER ?? "gemini";
  if (nombre === "gemini") return crearGeminiProvider();
  throw new Error(
    `LLM_PROVIDER="${nombre}" no está implementado. El primario es "gemini"; el fallback a Groq está decidido pero todavía no construido (ver docs/contexto/03-seleccion-modelo-llm.md).`,
  );
}
