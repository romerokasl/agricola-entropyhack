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
  /**
   * Token opaco del proveedor que hay que devolver tal cual al reenviar este turno.
   * Gemini 3.x rechaza con 400 un `functionCall` replicado sin su `thoughtSignature`.
   * No interpretarlo ni construirlo: solo guardarlo y devolverlo.
   */
  firmaProveedor?: string;
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
/**
 * OJO: en los modelos que razonan (Gemini 3.x), `maxOutputTokens` **incluye los tokens
 * de razonamiento**. Medido acá: con 200 el modelo gastó 189 pensando y le quedaron 7
 * para el mensaje, que salió truncado a media frase.
 *
 * Por eso el tope es alto: la brevedad NO se garantiza con el presupuesto de tokens,
 * se garantiza con el prompt (2–3 frases) y sobre todo con el validador determinista,
 * que rechaza cualquier respuesta de más de 3 frases. El tope solo evita que el
 * razonamiento se coma el mensaje.
 */
const MAX_OUTPUT_TOKENS = 1500;
/**
 * 30 s por intento. Parece mucho contra el objetivo de 4–5 s, pero es un techo, no un
 * objetivo: medido, el modelo responde en ~6 s con el prompt completo. Un timeout
 * apretado convierte una respuesta lenta en un error, que es peor que una lenta.
 */
const TIMEOUT_MS = 30_000;

/**
 * El tier gratuito devuelve 503 cuando el modelo está saturado, y 429 al pasarse de
 * cupo. Los dos son transitorios y los dos romperían el demo en vivo si no se
 * reintentan. Backoff creciente, con un techo bajo para no colgar el turno.
 */
const ESTADOS_TRANSITORIOS = new Set([429, 500, 502, 503, 504]);
const REINTENTOS = 3;
const ESPERA_BASE_MS = 600;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thoughtSignature?: string;
}

interface GeminiRespuesta {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/**
 * Rotación de modelos. **Medido contra la API**: el tier gratuito da
 * `GenerateRequestsPerDayPerProjectPerModel-FreeTier = 20` — veinte peticiones por día
 * **y por modelo**. Una conversación completa consume entre 4 y 6, así que un solo
 * modelo aguanta ~3 conversaciones diarias, y el plan del equipo es correr el demo
 * veinte veces.
 *
 * Como la cuota es por modelo, rotar multiplica la capacidad sin pagar nada. Cuando
 * uno devuelve 429, se pasa al siguiente. Se fijan versiones exactas en vez de
 * `gemini-flash-latest` para que el demo no cambie de modelo por debajo a mitad del
 * evento.
 *
 * Orden: primero los que mejor conversan; `flash-lite` al final, como red de
 * emergencia (es más rápido pero de menor calidad, y la calidad conversacional pesa
 * 20 puntos).
 */
const MODELOS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
] as const;

function crearGeminiProvider(): LlmProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  // GEMINI_MODEL fija uno solo y desactiva la rotación.
  const fijado = process.env.GEMINI_MODEL;
  const modelos = fijado ? [fijado] : [...MODELOS];

  return {
    nombre: "gemini",
    modeloVersion: modelos[0],

    async generar(peticion: PeticionLlm): Promise<RespuestaLlm> {
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY no está configurada. Ver .env.example.");
      }

      // Cuál modelo terminó atendiendo: se registra por turno para que el dashboard
      // muestre la rotación de verdad, no la intención.
      let modeloUsado = modelos[0];

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
            // Sin la firma, Gemini 3.x rechaza el turno replicado con un 400.
            ...(ll.firmaProveedor ? { thoughtSignature: ll.firmaProveedor } : {}),
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

      /** Intenta un modelo. `null` = agotó su cuota diaria, probá con el siguiente. */
      const pedirA = async (modelo: string): Promise<GeminiRespuesta | null> => {
        let ultimoError = "";

        for (let intento = 0; intento <= REINTENTOS; intento += 1) {
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

            if (res.ok) {
              modeloUsado = modelo;
              return (await res.json()) as GeminiRespuesta;
            }

            // Cuota agotada para ESTE modelo: insistir no sirve, hay que cambiar.
            if (res.status === 429) return null;

            const detalle = (await res.text().catch(() => "")).slice(0, 300);
            ultimoError = `Gemini respondió ${res.status}: ${detalle}`;
            // Un 4xx que no sea 429 es culpa nuestra: reintentar no lo va a arreglar.
            if (!ESTADOS_TRANSITORIOS.has(res.status)) throw new Error(ultimoError);
          } catch (e) {
            const esAbort = e instanceof Error && e.name === "AbortError";
            if (!esAbort && ultimoError === "") throw e;
            if (esAbort) ultimoError = `Gemini no respondió en ${TIMEOUT_MS} ms`;
            if (intento === REINTENTOS) throw new Error(ultimoError);
          } finally {
            clearTimeout(timeout);
          }

          if (intento < REINTENTOS) await esperar(ESPERA_BASE_MS * 2 ** intento);
        }

        throw new Error(ultimoError);
      };

      let datos: GeminiRespuesta | null = null;
      for (const candidato of modelos) {
        datos = await pedirA(candidato);
        if (datos) break;
      }

      if (!datos) {
        throw new Error(
          `Se agotó la cuota diaria del tier gratuito en todos los modelos (${modelos.join(", ")}). ` +
            "Son 20 peticiones por día y por modelo. Esperar al reinicio de cuota o usar otra API key.",
        );
      }
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
        .map((p) => ({
          nombre: p.functionCall.name,
          argumentos: p.functionCall.args ?? {},
          firmaProveedor: p.thoughtSignature,
        }));

      return {
        texto,
        llamadasTool,
        tokensIn: datos.usageMetadata?.promptTokenCount ?? null,
        tokensOut: datos.usageMetadata?.candidatesTokenCount ?? null,
        modeloVersion: modeloUsado,
        truncada: candidato?.finishReason === "MAX_TOKENS",
      };
    },
  };
}

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaMensaje {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaRespuesta {
  message?: OllamaMensaje;
  prompt_eval_count?: number;
  eval_count?: number;
  done_reason?: string;
}

/**
 * Proveedor local, solo para desarrollo/pruebas sin cuota mientras se ensaya el
 * flujo. Ver docs/contexto/03-seleccion-modelo-llm.md: Ollama está documentado ahí
 * como "última opción" por calidad de conversación en español y de tool-calling.
 * Se promueve a primario **temporalmente** (LLM_PROVIDER=ollama por defecto) para no
 * quemar la cuota gratuita de Gemini durante iteración; cuando el flujo esté
 * optimizado, volver a Gemini con LLM_PROVIDER=gemini (un solo valor de entorno, sin
 * tocar código, tal como exige `obtenerLlmProvider`).
 *
 * Requiere tener `ollama serve` corriendo local y el modelo descargado
 * (`ollama pull <modelo>`). Un modelo con soporte de tool-calling es obligatorio
 * porque el orquestador depende de `consultarCliente` / `consultarOpcionesValidas` /
 * `registrarAcuerdo` — por ejemplo `llama3.1`, `qwen2.5` o `mistral-nemo`.
 */
function crearOllamaProvider(): LlmProvider {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/+$/, "");
  const modelo = process.env.OLLAMA_MODEL ?? "llama3.1";
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 60_000);

  return {
    nombre: "ollama",
    modeloVersion: modelo,

    async generar(peticion: PeticionLlm): Promise<RespuestaLlm> {
      const systemInstruction = [peticion.systemPrompt, peticion.contexto]
        .concat(peticion.notaCorrectiva ? [`## CORRECCIÓN\n${peticion.notaCorrectiva}`] : [])
        .join("\n\n");

      const mensajes: OllamaMensaje[] = [{ role: "system", content: systemInstruction }];

      for (const m of peticion.historial) {
        if (m.rol === "tool" && m.resultadoTool) {
          mensajes.push({ role: "tool", content: JSON.stringify(m.resultadoTool.salida) });
          continue;
        }
        if (m.rol === "agente" && m.llamadasTool && m.llamadasTool.length > 0) {
          mensajes.push({
            role: "assistant",
            content: m.texto,
            tool_calls: m.llamadasTool.map((ll) => ({
              function: { name: ll.nombre, arguments: ll.argumentos },
            })),
          });
          continue;
        }
        mensajes.push({ role: m.rol === "cliente" ? "user" : "assistant", content: m.texto });
      }

      const body: Record<string, unknown> = {
        model: modelo,
        messages: mensajes,
        stream: false,
        options: { temperature: TEMPERATURE, num_predict: MAX_OUTPUT_TOKENS },
      };

      if (peticion.tools.length > 0) {
        body.tools = peticion.tools.map((t) => ({
          type: "function",
          function: { name: t.nombre, description: t.descripcion, parameters: t.parametros },
        }));
      }

      const controlador = new AbortController();
      const timeout = setTimeout(() => controlador.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controlador.signal,
        });
      } catch (e) {
        const esAbort = e instanceof Error && e.name === "AbortError";
        throw new Error(
          esAbort
            ? `Ollama no respondió en ${timeoutMs} ms (modelo "${modelo}"). Un modelo grande puede tardar más en la primera carga; subí OLLAMA_TIMEOUT_MS si hace falta.`
            : `No se pudo conectar a Ollama en ${baseUrl}. ¿Está corriendo "ollama serve" y descargado el modelo ("ollama pull ${modelo}")?`,
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const detalle = (await res.text().catch(() => "")).slice(0, 300);
        throw new Error(`Ollama respondió ${res.status}: ${detalle}`);
      }

      const datos = (await res.json()) as OllamaRespuesta;
      const mensaje = datos.message;

      const llamadasTool: LlamadaTool[] = (mensaje?.tool_calls ?? []).map((tc) => ({
        nombre: tc.function.name,
        argumentos: tc.function.arguments ?? {},
      }));

      return {
        texto: (mensaje?.content ?? "").trim(),
        llamadasTool,
        tokensIn: datos.prompt_eval_count ?? null,
        tokensOut: datos.eval_count ?? null,
        modeloVersion: modelo,
        truncada: datos.done_reason === "length",
      };
    },
  };
}

export function obtenerLlmProvider(): LlmProvider {
  const nombre = process.env.LLM_PROVIDER ?? "ollama";
  if (nombre === "gemini") return crearGeminiProvider();
  if (nombre === "ollama") return crearOllamaProvider();
  throw new Error(
    `LLM_PROVIDER="${nombre}" no está implementado. Proveedores disponibles: "ollama" (local, primario mientras se prueba el flujo) y "gemini" (AI Studio, para cuando el flujo esté optimizado). El fallback a Groq está decidido pero todavía no construido (ver docs/contexto/03-seleccion-modelo-llm.md).`,
  );
}
