/**
 * Verificación del enfoque speech-to-speech, sin red, sin base y sin API key.
 *
 * Cubre lo que se puede probar sin OpenAI: la conversión de audio, la interpretación de
 * los eventos de la Realtime API, que las tools e instrucciones sean las compartidas, y
 * sobre todo la compuerta — que una respuesta que no pasa el validador nunca se
 * reproduzca.
 *
 * Lo que NO cubre: la conexión real con OpenAI. Eso solo se prueba con una llamada.
 *
 * Uso:  npm run verify:s2s
 */

import assert from "node:assert/strict";

import { construirContexto, SYSTEM_PROMPT } from "../lib/agent/prompt";
import { DECLARACIONES } from "../lib/agent/tools";
import type { Cliente } from "../lib/agent/types";
import { senalSinRed } from "../lib/riesgo";
import {
  base64APcm16,
  concatenar,
  float32APcm16,
  pcm16ABase64,
  pcm16AFloat32,
  remuestrear,
} from "../voice/speech-to-speech/audio";
import { decidirTurno, MOTIVOS_RECHAZO, validarHablado } from "../voice/speech-to-speech/compuerta";
import {
  acumular,
  aToolsRealtime,
  construirInstruccionesS2S,
  eventos,
  GUIA_S2S,
  interpretarEvento,
  respuestaVacia,
  sumarUso,
  textoDeRespuesta,
} from "../voice/speech-to-speech/protocolo";

const HOY = new Date(2026, 8, 12);

const karla: Cliente = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "karla",
  nombre: "Karla Menjívar",
  edad: 27,
  distrito: "Soyapango",
  segmento: "Asalariado",
  tipoIngreso: "quincenal",
  diaIngreso1: 15,
  diaIngreso2: 30,
  diaRemesa: null,
  producto: "Tarjeta de crédito",
  cuota: 145,
  saldo: 1240,
  diaPago: 8,
  diasAtraso: 0,
  tieneDebitoAutomatico: false,
  riesgoScore: 62,
  riesgoBanda: "MODERATE_HIGH",
};

const ctxApertura = { cliente: karla, historial: [], esPrimerMensajeDelAgente: true };
const ctxSiguiente = { cliente: karla, historial: [], esPrimerMensajeDelAgente: false };

const ev = (objeto: Record<string, unknown>) => interpretarEvento(JSON.stringify(objeto));

const pruebas: Array<[string, () => void]> = [
  // --- Audio ----------------------------------------------------------------------
  ["Audio: Float32 → PCM16 → base64 → PCM16 → Float32 conserva la señal", () => {
    const original = new Float32Array([0, 0.5, -0.5, 0.25, -1, 1, 0.001]);
    const vuelta = pcm16AFloat32(base64APcm16(pcm16ABase64(float32APcm16(original))));
    assert.equal(vuelta.length, original.length);
    original.forEach((v, i) => assert.ok(Math.abs(v - vuelta[i]) < 1 / 16_000, `muestra ${i}`));
  }],
  ["Audio: un pico fuera de rango se recorta en vez de dar la vuelta", () => {
    const pcm = float32APcm16([1.7, -3]);
    assert.equal(pcm[0], 0x7fff);
    assert.equal(pcm[1], -0x8000);
  }],
  ["Audio: el PCM viaja little-endian", () => {
    const bytes = atob(pcm16ABase64(new Int16Array([0x0102])));
    assert.equal(bytes.charCodeAt(0), 0x02);
    assert.equal(bytes.charCodeAt(1), 0x01);
  }],
  ["Audio: remuestrear de 48 kHz a 24 kHz deja la mitad de muestras", () => {
    const entrada = new Float32Array(4800).map((_, i) => Math.sin(i / 10));
    assert.equal(remuestrear(entrada, 48_000, 24_000).length, 2400);
    assert.equal(remuestrear(entrada, 24_000, 24_000), entrada);
  }],
  ["Audio: concatenar respeta orden y largo", () => {
    const total = concatenar([new Float32Array([1, 2]), new Float32Array([3])]);
    assert.deepEqual(Array.from(total), [1, 2, 3]);
  }],

  // --- Lo compartido ---------------------------------------------------------------
  ["Tools: son las MISMAS declaraciones del canal de texto", () => {
    const tools = aToolsRealtime(DECLARACIONES);
    assert.deepEqual(tools.map((t) => t.name), DECLARACIONES.map((d) => d.nombre));
    assert.ok(tools.every((t) => t.type === "function"));
    assert.equal(tools[2].parameters, DECLARACIONES[2].parametros);
  }],
  ["Instrucciones: llevan el prompt compartido, el contexto de voz y la guía S2S", () => {
    const contexto = construirContexto(karla, "agente", HOY, senalSinRed(karla, HOY), "voz");
    const instrucciones = construirInstruccionesS2S(SYSTEM_PROMPT, contexto);
    assert.ok(instrucciones.startsWith(SYSTEM_PROMPT));
    assert.ok(instrucciones.includes("ESTE TURNO ES POR TELÉFONO"));
    assert.ok(instrucciones.includes("OPCIONES VÁLIDAS"));
    assert.ok(instrucciones.endsWith(GUIA_S2S));
  }],
  ["Motivos: la lista de la ruta coincide con los del validador", () => {
    assert.equal(new Set(MOTIVOS_RECHAZO).size, MOTIVOS_RECHAZO.length);
    assert.ok(MOTIVOS_RECHAZO.includes("truncada"));
  }],

  // --- Eventos de la Realtime API ---------------------------------------------------
  ["Eventos: JSON inválido o tipo ajeno no lanzan", () => {
    assert.equal(interpretarEvento("{no es json").type, "desconocido");
    assert.equal(ev({ type: "rate_limits.updated" }).type, "desconocido");
  }],
  ["Eventos: error con código", () => {
    assert.deepEqual(ev({ type: "error", error: { message: "x", code: "response_cancel_not_active" } }), {
      type: "error",
      mensaje: "x",
      codigo: "response_cancel_not_active",
    });
  }],
  ["Eventos: transcripción de la persona", () => {
    assert.deepEqual(
      ev({ type: "conversation.item.input_audio_transcription.completed", item_id: "it1", transcript: "movela al 16" }),
      { type: "conversation.item.input_audio_transcription.completed", itemId: "it1", transcripcion: "movela al 16" },
    );
  }],
  ["Eventos: response.done trae estado, uso y llamadas a herramientas", () => {
    const e = ev({
      type: "response.done",
      response: {
        id: "resp_1",
        status: "completed",
        usage: { input_tokens: 1200, output_tokens: 90 },
        output: [
          { type: "message", id: "msg_1" },
          { type: "function_call", call_id: "call_1", name: "registrarAcuerdo", arguments: "{\"tipo\":\"mover_fecha\",\"diaAcordado\":16}" },
        ],
      },
    });
    assert.equal(e.type, "response.done");
    if (e.type !== "response.done") return;
    assert.equal(e.estado, "completed");
    assert.deepEqual(e.uso, { tokensIn: 1200, tokensOut: 90 });
    assert.deepEqual(e.llamadas, [
      { callId: "call_1", nombre: "registrarAcuerdo", argumentos: "{\"tipo\":\"mover_fecha\",\"diaAcordado\":16}" },
    ]);
  }],

  // --- Acumulador ------------------------------------------------------------------
  ["Acumulador: junta audio, transcripción final y uso", () => {
    const r = respuestaVacia();
    for (const evento of [
      { type: "response.created", response: { id: "resp_1" } },
      { type: "response.output_item.added", item: { id: "msg_1", type: "message" } },
      { type: "response.output_audio.delta", item_id: "msg_1", delta: "AAA=" },
      { type: "response.output_audio_transcript.delta", item_id: "msg_1", delta: "Hola Kar" },
      { type: "response.output_audio.delta", item_id: "msg_1", delta: "BBB=" },
      { type: "response.output_audio_transcript.delta", item_id: "msg_1", delta: "la" },
      { type: "response.output_audio_transcript.done", item_id: "msg_1", transcript: "Hola Karla." },
      { type: "response.done", response: { id: "resp_1", status: "completed", usage: { input_tokens: 10, output_tokens: 5 }, output: [] } },
    ]) {
      acumular(r, ev(evento));
    }
    assert.equal(r.responseId, "resp_1");
    assert.deepEqual(r.itemsMensaje, ["msg_1"]);
    assert.deepEqual(r.audio, ["AAA=", "BBB="]);
    assert.equal(textoDeRespuesta(r), "Hola Karla.");
    assert.equal(r.estado, "completada");
    assert.deepEqual(r.uso, { tokensIn: 10, tokensOut: 5 });
  }],
  ["Acumulador: la misma llamada a herramienta no se duplica", () => {
    const r = respuestaVacia();
    const llamada = { call_id: "call_1", name: "consultarOpcionesValidas", arguments: "{}" };
    acumular(r, ev({ type: "response.function_call_arguments.done", item_id: "fc_1", ...llamada }));
    acumular(r, ev({ type: "response.done", response: { status: "completed", output: [{ type: "function_call", ...llamada }] } }));
    assert.equal(r.llamadas.length, 1);
  }],
  ["Acumulador: los estados de la API se traducen, y uno desconocido cuenta como fallido", () => {
    const estado = (status: string) =>
      acumular(respuestaVacia(), ev({ type: "response.done", response: { status } })).estado;
    assert.equal(estado("cancelled"), "cancelada");
    assert.equal(estado("incomplete"), "incompleta");
    assert.equal(estado("algo_nuevo"), "fallida");
  }],
  ["Uso: se suma entre las respuestas del turno", () => {
    assert.deepEqual(sumarUso({ tokensIn: 1, tokensOut: 2 }, { tokensIn: 3, tokensOut: 4 }), { tokensIn: 4, tokensOut: 6 });
    assert.deepEqual(sumarUso(null, { tokensIn: 1, tokensOut: 1 }), { tokensIn: 1, tokensOut: 1 });
    assert.equal(sumarUso(null, null), null);
  }],

  // --- Eventos de cliente ------------------------------------------------------------
  ["Cliente: la nota correctiva entra como mensaje de sistema", () => {
    assert.deepEqual(eventos.mensajeSistema("nota"), {
      type: "conversation.item.create",
      item: { type: "message", role: "system", content: [{ type: "input_text", text: "nota" }] },
    });
  }],
  ["Cliente: el techo del ciclo de tools fuerza una respuesta sin herramientas", () => {
    assert.deepEqual(eventos.pedirRespuesta(true), { type: "response.create", response: { tool_choice: "none" } });
    assert.deepEqual(eventos.pedirRespuesta(), { type: "response.create" });
  }],
  ["Cliente: el truncado nunca manda milisegundos negativos ni fraccionarios", () => {
    assert.equal(eventos.truncarItem("msg_1", -5).audio_end_ms, 0);
    assert.equal(eventos.truncarItem("msg_1", 1234.6).audio_end_ms, 1235);
  }],

  // --- La compuerta -------------------------------------------------------------------
  ["Compuerta: una respuesta válida se reproduce", () => {
    const v = validarHablado(
      "Hola Karla, soy el asistente de Bancoagrícola. Tu cuota de $145.00 vence el 8. ¿Se te complica esa fecha?",
      true,
      ctxApertura,
    );
    assert.deepEqual(decidirTurno(v, 1), { accion: "reproducir" });
  }],
  ["Compuerta: una respuesta incompleta NUNCA suena, aunque lo dicho pase", () => {
    const v = validarHablado("Hola Karla, soy el asistente de Bancoagrícola.", false, ctxApertura);
    assert.equal(v.motivo, "truncada");
    assert.equal(decidirTurno(v, 1).accion, "reintentar");
  }],
  ["Compuerta: otro banco en el primer intento → reintento con nota", () => {
    const decision = decidirTurno(validarHablado("Podés pagarlo en el Cuscatlán.", true, ctxSiguiente), 1);
    assert.equal(decision.accion, "reintentar");
    if (decision.accion !== "reintentar") return;
    assert.equal(decision.motivo, "otro_banco");
    assert.ok(decision.notaCorrectiva.length > 0);
  }],
  ["Compuerta: si falla el segundo intento, respuesta segura — el audio del modelo no suena", () => {
    const decision = decidirTurno(validarHablado("Te condono el pago, sos morosa.", true, ctxSiguiente), 2);
    assert.deepEqual(decision, { accion: "respuesta_segura", motivo: "palabra_prohibida" });
  }],
  ["Compuerta: un monto inventado se bloquea igual que en texto", () => {
    const v = validarHablado("Tu cuota es de $999.00 este mes.", true, ctxSiguiente);
    assert.equal(v.motivo, "monto_inventado");
  }],
  ["Compuerta: el saludo sin presentación se bloquea", () => {
    assert.equal(validarHablado("Hola Karla, ¿cómo estás?", true, ctxApertura).motivo, "falta_presentacion");
  }],
  ["Compuerta: una transcripción vacía no se reproduce", () => {
    assert.equal(decidirTurno(validarHablado("   ", true, ctxSiguiente), 2).accion, "respuesta_segura");
  }],
];

let fallos = 0;
for (const [nombre, prueba] of pruebas) {
  try {
    prueba();
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    fallos += 1;
    console.error(`  FALLA ${nombre}`);
    console.error(`        ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  }
}

console.log(`\n${pruebas.length - fallos}/${pruebas.length} verificaciones pasaron.`);
process.exit(fallos === 0 ? 0 : 1);
