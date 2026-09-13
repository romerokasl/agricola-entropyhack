import type { AccionCliente, Marcador, Mensaje } from "@/components/whatsapp/types";

/**
 * El guion del demo de WhatsApp.
 *
 * Es DATO, no lógica: el reproductor de `app/demo/whatsapp` no sabe nada de
 * Karla ni de Wilber, solo recorre eventos. Por eso el mismo reproductor puede
 * alimentarse de /api/chat el día que se enchufe el agente real — cambia la
 * fuente de los eventos, no el canal.
 *
 * Los cuatro escenarios existen para probar cuatro cosas distintas ante el jurado:
 *   karla  → el caso estrella: una desalineación de calendario que cuesta $0
 *   wilber → el agente cambia de escalón cuando la persona dice que no puede
 *   rosa   → entrante: la persona escribe primero y pide ver sus opciones
 *   marta  → el sistema se NIEGA a contactar a quien no lo necesita
 */

export type TipoPaso =
  | "disparador"
  | "razonamiento"
  | "tool"
  | "guardrail"
  | "decision"
  | "registro";

export interface PasoConsola {
  id: string;
  tipo: TipoPaso;
  etiqueta: string;
  detalle?: string;
}

export interface MetricasTurno {
  latenciaMs: number;
  tokensIn: number;
  tokensOut: number;
  validadorOk: boolean;
  escalon?: number;
}

export type Evento =
  | { clase: "marcador"; espera: number; elemento: Marcador }
  | {
      clase: "agente";
      espera: number;
      /** Cuánto dura el "escribiendo…" mientras la consola muestra el razonamiento. */
      pensando: number;
      pasos: readonly PasoConsola[];
      metricas: MetricasTurno;
      mensaje: Mensaje;
    }
  | { clase: "cliente"; espera: number; mensaje: Mensaje }
  | {
      /** El guion se detiene y arma un mensaje interactivo hasta que lo toquen. */
      clase: "espera";
      sobre: string;
      accion: AccionCliente;
      /** Qué le aparece a la persona en el hilo después de tocar. */
      respuesta?: Mensaje;
      pasos?: readonly PasoConsola[];
      pista: string;
      /** En modo automático se resuelve solo después de este tiempo. */
      autoMs: number;
    };

export interface Escenario {
  slug: string;
  nombre: string;
  etiqueta: string;
  resumen: string;
  horaTelefono: string;
  perfil: readonly { campo: string; valor: string }[];
  disparador: { titulo: string; senal: string; detalle: string };
  /** Riesgo interno. Este es el único lugar del demo donde se permite el rojo. */
  banda: "SANO" | "PREVENTIVO" | "ATENCION";
  eventos: readonly Evento[];
  /** Respuesta segura cuando alguien escribe algo fuera del guion. */
  fueraDeGuion: string;
}

/* ========================================================================== */
/* Karla — desalineación quincena ↔ fecha de pago                             */
/* ========================================================================== */

const karla: Escenario = {
  slug: "karla",
  nombre: "Karla Menjívar",
  etiqueta: "Desalineación de quincena",
  resumen:
    "Cobra el 15 y el 30; su cuota vence el 8. Paga tarde todos los meses sin ser mala pagadora. Mover la fecha cuesta $0.",
  horaTelefono: "9:41",
  banda: "PREVENTIVO",
  perfil: [
    { campo: "Producto", valor: "Crédito de consumo ****4471" },
    { campo: "Cuota", valor: "$87.40" },
    { campo: "Vence", valor: "8 de cada mes" },
    { campo: "Cobra", valor: "15 y 30 (quincenal)" },
    { campo: "Días de atraso", valor: "0" },
    { campo: "Distrito", valor: "Soyapango" },
  ],
  disparador: {
    titulo: "Desalineación de calendario",
    senal: "11 de los últimos 12 pagos entraron entre 5 y 9 días tarde",
    detalle:
      "No es capacidad de pago: es que el vencimiento cae el día del mes en que ya no le queda nada. Ningún buró tiene esta señal; el banco sí, porque le ve entrar la planilla.",
  },
  fueraDeGuion:
    "Te leo, Karla. Para no darte un dato equivocado prefiero pasarte con una persona del equipo. ¿Te parece si te contacta hoy mismo?",
  eventos: [
    {
      clase: "marcador",
      espera: 300,
      elemento: {
        clase: "marcador",
        id: "m-cifrado",
        variante: "cifrado",
        texto:
          "Los mensajes están cifrados de extremo a extremo. Bancoagrícola nunca te va a pedir tu PIN ni tu clave por este medio.",
      },
    },
    {
      clase: "marcador",
      espera: 500,
      elemento: { clase: "marcador", id: "m-hoy", variante: "fecha", texto: "Hoy" },
    },
    {
      clase: "agente",
      espera: 700,
      pensando: 2400,
      metricas: { latenciaMs: 1180, tokensIn: 842, tokensOut: 96, validadorOk: true, escalon: 2 },
      pasos: [
        {
          id: "k1",
          tipo: "disparador",
          etiqueta: "Señal detectada · desalineación de calendario",
          detalle: "Cobra 15 y 30 · la cuota vence el 8 · faltan 6 días",
        },
        {
          id: "k2",
          tipo: "tool",
          etiqueta: "consultarCliente()",
          detalle: "cuota $87.40 · vence día 8 · atraso 0 d · débito automático: no",
        },
        {
          id: "k3",
          tipo: "razonamiento",
          etiqueta: "No es un problema de plata, es de calendario",
          detalle: "Cero días de atraso hoy. El patrón es estructural, no de capacidad.",
        },
        {
          id: "k4",
          tipo: "tool",
          etiqueta: "consultarOpcionesValidas()",
          detalle: "8 escalones disponibles · mínimo suficiente = 2",
        },
        {
          id: "k5",
          tipo: "decision",
          etiqueta: "Escalón 2 · Mover la fecha de pago al 16",
          detalle: "Costo para el banco: $0. No se toca capital ni intereses.",
        },
        {
          id: "k6",
          tipo: "guardrail",
          etiqueta: "Una sola acción por mensaje",
          detalle: "Se ofrece mover la fecha y nada más. La escalera completa queda en reserva.",
        },
        {
          id: "k7",
          tipo: "guardrail",
          etiqueta: "Sin urgencia falsa",
          detalle: "Faltan 6 días y el mensaje dice 6 días.",
        },
        {
          id: "k8",
          tipo: "registro",
          etiqueta: "Plantilla utility aprobada",
          detalle: "recordatorio_fecha_pago_v3 · fuera de ventana de 24 h",
        },
      ],
      mensaje: {
        id: "a1",
        autor: "agente",
        hora: "9:41 a. m.",
        tipo: "plantilla",
        categoria: "utility",
        nombrePlantilla: "recordatorio_fecha_pago_v3",
        anotacion: "template · utility",
        encabezado: "Tu cuota de septiembre",
        texto:
          "Hola Karla 👋 Te faltan 6 días para tu cuota de $87.40, que vence el lunes 8.\n\nRevisando tu historial vi algo: vos cobrás el 15 y el 30, así que el 8 casi nunca te queda cómodo. ¿Te cuento cómo moverlo?",
        pie: "Mensaje automático de Bancoagrícola · escribí “asesor” cuando querás",
        botones: [
          { id: "si", texto: "Sí, contame" },
          { id: "no", texto: "Ahora no" },
        ],
      },
    },
    {
      clase: "espera",
      sobre: "a1",
      accion: { tipo: "boton", botonId: "si" },
      pista: "Tocá “Sí, contame” en el teléfono",
      autoMs: 2600,
      pasos: [
        {
          id: "k9",
          tipo: "razonamiento",
          etiqueta: "Respuesta: “Sí, contame”",
          detalle: "Ventana de servicio de 24 h abierta. A partir de acá no hace falta plantilla.",
        },
      ],
      respuesta: {
        id: "c1",
        autor: "cliente",
        hora: "9:42 a. m.",
        estado: "leido",
        tipo: "texto",
        texto: "Sí, contame",
      },
    },
    {
      clase: "agente",
      espera: 400,
      pensando: 1800,
      metricas: { latenciaMs: 940, tokensIn: 1012, tokensOut: 78, validadorOk: true, escalon: 2 },
      pasos: [
        {
          id: "k10",
          tipo: "razonamiento",
          etiqueta: "Explicar la mecánica antes de pedir nada",
          detalle: "Primero el porqué; el pedido viene después.",
        },
        {
          id: "k11",
          tipo: "guardrail",
          etiqueta: "Cero jerga",
          detalle: "Sin “mora”, sin “score”, sin “provisión”. Dice “tu pago” y “tu récord”.",
        },
      ],
      mensaje: {
        id: "a2",
        autor: "agente",
        hora: "9:42 a. m.",
        tipo: "texto",
        anotacion: "text",
        texto:
          "Si movemos tu fecha del 8 al 16, te queda justo al día siguiente de que cobrás. La cuota sigue siendo la misma, $87.40, y el cambio no tiene ningún costo.",
      },
    },
    {
      clase: "agente",
      espera: 900,
      pensando: 1500,
      metricas: { latenciaMs: 860, tokensIn: 1090, tokensOut: 64, validadorOk: true, escalon: 2 },
      pasos: [
        {
          id: "k12",
          tipo: "decision",
          etiqueta: "Encuesta nativa para definir el parámetro",
          detalle:
            "Sigue siendo una sola acción — mover la fecha. La encuesta elige el día, no agrega opciones nuevas.",
        },
      ],
      mensaje: {
        id: "a3",
        autor: "agente",
        hora: "9:43 a. m.",
        tipo: "encuesta",
        anotacion: "poll",
        pregunta: "¿Qué día te queda mejor para pagar?",
        nota: "Selecciona una opción",
        opciones: [
          { id: "d16", texto: "16 — un día después de tu quincena", votos: 0 },
          { id: "d17", texto: "17", votos: 0 },
          { id: "d30", texto: "30 — con tu segunda quincena", votos: 0 },
        ],
      },
    },
    {
      clase: "espera",
      sobre: "a3",
      accion: { tipo: "encuesta", opcionId: "d16" },
      pista: "Votá en la encuesta",
      autoMs: 3000,
      pasos: [
        {
          id: "k13",
          tipo: "razonamiento",
          etiqueta: "Voto recibido: día 16",
          detalle: "Coincide con la recomendación del motor. No hay que negociar más.",
        },
      ],
    },
    {
      clase: "agente",
      espera: 600,
      pensando: 1900,
      metricas: { latenciaMs: 1020, tokensIn: 1184, tokensOut: 71, validadorOk: true, escalon: 2 },
      pasos: [
        {
          id: "k14",
          tipo: "decision",
          etiqueta: "Cierre dentro del canal",
          detalle: "WhatsApp Flow: el formulario corre adentro de WhatsApp, sin sacarla a un navegador.",
        },
        {
          id: "k15",
          tipo: "guardrail",
          etiqueta: "Plazo dentro de límite",
          detalle: "Del 8 al 16 son 8 días, dentro del mismo ciclo. Tope permitido: 30.",
        },
      ],
      mensaje: {
        id: "a4",
        autor: "agente",
        hora: "9:44 a. m.",
        tipo: "flujo",
        anotacion: "interactive · flow",
        texto: "Perfecto. Confirmalo acá mismo y queda hecho — no tenés que ir a ninguna agencia.",
        pie: "Toma menos de un minuto",
        etiquetaBoton: "Confirmar nueva fecha",
        flujo: {
          titulo: "Cambio de fecha de pago",
          subtitulo: "Bancoagrícola · conexión segura",
          etiquetaEnvio: "Confirmar cambio",
          campos: [
            { tipo: "info", id: "f1", etiqueta: "Producto", valor: "Consumo ****4471" },
            { tipo: "info", id: "f2", etiqueta: "Cuota mensual", valor: "$87.40" },
            { tipo: "info", id: "f3", etiqueta: "Fecha actual", valor: "8 de cada mes" },
            {
              tipo: "opcion",
              id: "f4",
              etiqueta: "Nueva fecha de pago",
              opciones: [
                { id: "d16", etiqueta: "16 de cada mes", nota: "Un día después de tu quincena" },
                { id: "d17", etiqueta: "17 de cada mes" },
                { id: "d30", etiqueta: "30 de cada mes", nota: "Con tu segunda quincena" },
              ],
            },
          ],
        },
      },
    },
    {
      clase: "espera",
      sobre: "a4",
      accion: { tipo: "flujo", resumen: "16 de cada mes" },
      pista: "Abrí el formulario y confirmá",
      autoMs: 3400,
      pasos: [
        {
          id: "k16",
          tipo: "tool",
          etiqueta: "registrarAcuerdo({ tipo: “mover_fecha”, diaAcordado: 16 })",
          detalle: "Acuerdo persistido · conversación marcada como cerrada_con_acuerdo",
        },
      ],
      respuesta: {
        id: "c2",
        autor: "cliente",
        hora: "9:45 a. m.",
        estado: "leido",
        tipo: "texto",
        anotacion: "interactive · nfm_reply",
        texto: "Confirmado: 16 de cada mes ✅",
      },
    },
    {
      clase: "agente",
      espera: 500,
      pensando: 1600,
      metricas: { latenciaMs: 890, tokensIn: 1260, tokensOut: 83, validadorOk: true, escalon: 2 },
      pasos: [
        {
          id: "k17",
          tipo: "guardrail",
          etiqueta: "Salida a un humano siempre disponible",
          detalle: "El cierre repite cómo llegar a una persona.",
        },
      ],
      mensaje: {
        id: "a5",
        autor: "agente",
        hora: "9:45 a. m.",
        tipo: "texto",
        texto:
          "Listo, Karla. Tu próxima cuota vence el 16 de octubre y ya no te va a agarrar sin quincena. Te dejo la constancia acá abajo; si algo no cuadra, escribí “asesor”.",
      },
    },
    {
      clase: "agente",
      espera: 700,
      pensando: 900,
      metricas: { latenciaMs: 310, tokensIn: 0, tokensOut: 0, validadorOk: true },
      pasos: [
        {
          id: "k18",
          tipo: "registro",
          etiqueta: "Constancia generada y adjuntada",
          detalle: "El acuerdo queda por escrito del lado de la persona, no solo del banco.",
        },
      ],
      mensaje: {
        id: "a6",
        autor: "agente",
        hora: "9:45 a. m.",
        tipo: "documento",
        anotacion: "document",
        nombre: "Constancia-cambio-fecha.pdf",
        paginas: 1,
        peso: "96 kB",
      },
    },
    {
      clase: "espera",
      sobre: "a5",
      accion: { tipo: "reaccion", emoji: "👍" },
      pista: "Tocá el 👍 que aparece junto al mensaje",
      autoMs: 2200,
    },
    {
      clase: "marcador",
      espera: 900,
      elemento: {
        clase: "marcador",
        id: "m-cierre",
        variante: "aviso",
        texto: "Acuerdo registrado · esta conversación se cerró sola",
      },
    },
  ],
};

/* ========================================================================== */
/* Wilber — atrasado, dentro de la ventana de reporte al buró                  */
/* ========================================================================== */

const wilber: Escenario = {
  slug: "wilber",
  nombre: "Wilber Alvarenga",
  etiqueta: "Ventana de 10 días",
  resumen:
    "Primer crédito. Seis días de atraso por olvido. Faltan 4 días para que el buró consolide: todavía se puede evitar.",
  horaTelefono: "4:12",
  banda: "ATENCION",
  perfil: [
    { campo: "Producto", valor: "Crédito personal ****9120" },
    { campo: "Cuota", valor: "$68.00" },
    { campo: "Venció", valor: "hace 6 días" },
    { campo: "Cobra", valor: "15 y 30 (quincenal)" },
    { campo: "Ventana de buró", valor: "4 días restantes" },
    { campo: "Distrito", valor: "Santa Tecla" },
  ],
  disparador: {
    titulo: "Atraso dentro de ventana recuperable",
    senal: "6 días de atraso · corte del buró en 4 días",
    detalle:
      "Por ley los burós actualizan en los primeros 10 días del mes. La urgencia es real y verificable — no hay que inventarla.",
  },
  fueraDeGuion:
    "Te entiendo, Wilber. No quiero darte un dato equivocado, así que te paso con una persona del equipo hoy mismo. ¿Te parece?",
  eventos: [
    {
      clase: "marcador",
      espera: 300,
      elemento: {
        clase: "marcador",
        id: "w-cifrado",
        variante: "cifrado",
        texto:
          "Los mensajes están cifrados de extremo a extremo. Bancoagrícola nunca te va a pedir tu PIN ni tu clave por este medio.",
      },
    },
    {
      clase: "marcador",
      espera: 400,
      elemento: { clase: "marcador", id: "w-hoy", variante: "fecha", texto: "Hoy" },
    },
    {
      clase: "agente",
      espera: 700,
      pensando: 2600,
      metricas: { latenciaMs: 1240, tokensIn: 878, tokensOut: 104, validadorOk: true, escalon: 1 },
      pasos: [
        {
          id: "w1",
          tipo: "disparador",
          etiqueta: "Atraso de 6 días",
          detalle: "Primer atraso en 14 meses de historial. Perfil de olvido, no de incapacidad.",
        },
        {
          id: "w2",
          tipo: "tool",
          etiqueta: "consultarCliente()",
          detalle: "cuota $68.00 · atraso 6 d · corte de buró en 4 d",
        },
        {
          id: "w3",
          tipo: "guardrail",
          etiqueta: "Prohibido amenazar",
          detalle: "Nada de consecuencias legales, nada de terceros, nada de juicio moral.",
        },
        {
          id: "w4",
          tipo: "guardrail",
          etiqueta: "Urgencia honesta",
          detalle: "4 días es un dato verificable en la norma, no una presión inventada.",
        },
        {
          id: "w5",
          tipo: "decision",
          etiqueta: "Escalón 1 · Recordatorio con fecha límite real",
          detalle: "Todavía no hace falta ofrecer nada más caro.",
        },
      ],
      mensaje: {
        id: "wa1",
        autor: "agente",
        hora: "4:12 p. m.",
        tipo: "plantilla",
        categoria: "utility",
        nombrePlantilla: "ventana_buro_v2",
        anotacion: "template · utility",
        encabezado: "Todavía estás a tiempo",
        texto:
          "Hola Wilber. Tu cuota de $68.00 venció hace 6 días.\n\nNo te escribo para presionarte: te escribo porque todavía se puede resolver sin que quede en tu historial. Los burós consolidan el reporte en los primeros 10 días del mes y te quedan 4.",
        pie: "Bancoagrícola · escribí “asesor” cuando querás",
        botones: [
          { id: "que_hago", texto: "¿Qué tengo que hacer?" },
          { id: "asesor", texto: "Hablar con alguien" },
        ],
      },
    },
    {
      clase: "espera",
      sobre: "wa1",
      accion: { tipo: "boton", botonId: "que_hago" },
      pista: "Tocá “¿Qué tengo que hacer?”",
      autoMs: 2800,
      respuesta: {
        id: "wc1",
        autor: "cliente",
        hora: "4:13 p. m.",
        estado: "leido",
        tipo: "texto",
        texto: "¿Qué tengo que hacer?",
      },
    },
    {
      clase: "agente",
      espera: 400,
      pensando: 1700,
      metricas: { latenciaMs: 880, tokensIn: 1004, tokensOut: 68, validadorOk: true, escalon: 1 },
      pasos: [
        {
          id: "w6",
          tipo: "guardrail",
          etiqueta: "Una sola acción",
          detalle: "Un solo paso, un solo monto, una sola fecha.",
        },
      ],
      mensaje: {
        id: "wa2",
        autor: "agente",
        hora: "4:13 p. m.",
        tipo: "cta",
        anotacion: "interactive · cta_url",
        texto:
          "Un solo paso: $68.00 antes del viernes y tu historial queda limpio. Lo podés hacer desde la app en menos de un minuto.",
        pie: "Te lleva a tu banca móvil, no a un enlace externo",
        etiquetaBoton: "Pagar en la app",
        url: "banca.bancoagricola.com",
      },
    },
    {
      clase: "espera",
      sobre: "wa2",
      accion: { tipo: "cta" },
      pista: "Tocá “Pagar en la app” (Wilber va a responder que no puede)",
      autoMs: 3200,
      pasos: [
        {
          id: "w7",
          tipo: "razonamiento",
          etiqueta: "La persona declara falta de liquidez",
          detalle: "Cambia el diagnóstico: ya no es olvido. Hay que subir de escalón.",
        },
      ],
      respuesta: {
        id: "wc2",
        autor: "cliente",
        hora: "4:15 p. m.",
        estado: "leido",
        tipo: "texto",
        texto: "Es que no tengo saldo hasta el 15 😕",
      },
    },
    {
      clase: "agente",
      espera: 500,
      pensando: 3100,
      metricas: { latenciaMs: 1460, tokensIn: 1188, tokensOut: 112, validadorOk: true, escalon: 3 },
      pasos: [
        {
          id: "w8",
          tipo: "tool",
          etiqueta: "consultarOpcionesValidas()",
          detalle: "Recalculado con la nueva información",
        },
        {
          id: "w9",
          tipo: "decision",
          etiqueta: "Escalón 3 · Abono parcial de $26.00",
          detalle: "38 % de la cuota, sobre el mínimo del 30 %. Evita el deterioro.",
        },
        {
          id: "w10",
          tipo: "guardrail",
          etiqueta: "No se condona nada",
          detalle: "Ni capital ni intereses. El resto se paga el 15.",
        },
        {
          id: "w11",
          tipo: "guardrail",
          etiqueta: "Sin culpa ni juicio",
          detalle: "La respuesta valida la situación antes de proponer.",
        },
      ],
      mensaje: {
        id: "wa3",
        autor: "agente",
        hora: "4:15 p. m.",
        tipo: "botones",
        anotacion: "interactive · button",
        cita: { autor: "Wilber", texto: "Es que no tengo saldo hasta el 15 😕" },
        texto:
          "Gracias por decírmelo, eso cambia las cosas. Hagamos algo distinto: con $26.00 hoy se frena el deterioro, y el resto lo pagás el 15 cuando cobrés.",
        pie: "No se te cobra nada extra por dividirlo",
        botones: [
          { id: "acepto", texto: "Sí, hago el abono" },
          { id: "asesor", texto: "Prefiero un asesor" },
        ],
      },
    },
    {
      clase: "espera",
      sobre: "wa3",
      accion: { tipo: "boton", botonId: "acepto" },
      pista: "Tocá “Sí, hago el abono”",
      autoMs: 2800,
      pasos: [
        {
          id: "w12",
          tipo: "tool",
          etiqueta: "registrarAcuerdo({ tipo: “abono_parcial”, monto: 26, diaAcordado: 12 })",
          detalle: "Acuerdo persistido · seguimiento programado para el 15",
        },
      ],
      respuesta: {
        id: "wc3",
        autor: "cliente",
        hora: "4:16 p. m.",
        estado: "leido",
        tipo: "texto",
        texto: "Sí, hago el abono",
      },
    },
    {
      clase: "agente",
      espera: 400,
      pensando: 1500,
      metricas: { latenciaMs: 810, tokensIn: 1290, tokensOut: 74, validadorOk: true, escalon: 3 },
      pasos: [
        {
          id: "w13",
          tipo: "razonamiento",
          etiqueta: "Bajar la fricción del pago en efectivo",
          detalle: "890+ corresponsales cubren el 100 % de los distritos.",
        },
      ],
      mensaje: {
        id: "wa4",
        autor: "agente",
        hora: "4:16 p. m.",
        tipo: "texto",
        texto:
          "Hecho. Te espero los $26.00 hoy antes de las 8 p. m. Si te queda más cómodo en efectivo, tenés un corresponsal a dos cuadras:",
      },
    },
    {
      clase: "agente",
      espera: 800,
      pensando: 800,
      metricas: { latenciaMs: 290, tokensIn: 0, tokensOut: 0, validadorOk: true },
      pasos: [
        {
          id: "w14",
          tipo: "registro",
          etiqueta: "Corresponsal más cercano resuelto por distrito",
          detalle: "Dato de red real, no generado por el modelo.",
        },
      ],
      mensaje: {
        id: "wa5",
        autor: "agente",
        hora: "4:16 p. m.",
        tipo: "ubicacion",
        anotacion: "location",
        nombre: "Corresponsal Bancoagrícola",
        direccion: "Súper Selectos Plaza Merliot · abierto hasta las 8:00 p. m.",
      },
    },
    {
      clase: "agente",
      espera: 900,
      pensando: 1400,
      metricas: { latenciaMs: 640, tokensIn: 1310, tokensOut: 52, validadorOk: true },
      pasos: [
        {
          id: "w15",
          tipo: "decision",
          etiqueta: "Cierre en nota de voz",
          detalle:
            "Voz es el canal donde el banco más gestiona hoy. El mismo agente resuelve en audio y deja transcripción trazable.",
        },
      ],
      mensaje: {
        id: "wa6",
        autor: "agente",
        hora: "4:17 p. m.",
        tipo: "audio",
        anotacion: "audio · voice note",
        duracion: "0:12",
        transcripcion:
          "Wilber, quedamos así: veintiséis dólares hoy y el resto el quince. Cualquier cosa me escribís por acá.",
      },
    },
    {
      clase: "agente",
      espera: 900,
      pensando: 900,
      metricas: { latenciaMs: 300, tokensIn: 0, tokensOut: 0, validadorOk: true },
      pasos: [
        {
          id: "w16",
          tipo: "guardrail",
          etiqueta: "Salida a un humano, siempre",
          detalle: "Guardrail del banco: la persona nunca queda encerrada con el bot.",
        },
      ],
      mensaje: {
        id: "wa7",
        autor: "agente",
        hora: "4:17 p. m.",
        tipo: "contacto",
        anotacion: "contacts",
        nombre: "Gabriela Cortez",
        rol: "Tu asesora asignada · Bancoagrícola",
        telefono: "+503 2267 0000",
      },
    },
    {
      clase: "espera",
      sobre: "wa6",
      accion: { tipo: "reaccion", emoji: "🙏" },
      pista: "Tocá el 🙏 que aparece junto a la nota de voz",
      autoMs: 2400,
    },
    {
      clase: "marcador",
      espera: 800,
      elemento: {
        clase: "marcador",
        id: "w-cierre",
        variante: "aviso",
        texto: "Acuerdo registrado · abono parcial $26.00 · seguimiento el 15",
      },
    },
  ],
};

/* ========================================================================== */
/* Rosa — entrante: la persona escribe primero y pide ver opciones             */
/* ========================================================================== */

const rosa: Escenario = {
  slug: "rosa",
  nombre: "Rosa Hernández",
  etiqueta: "Entrante · pide opciones",
  resumen:
    "Tiene una tienda. Sus ventas caen 40 % cada septiembre. Escribe ella primero, antes de fallar: el agente también atiende entrante, no solo sale a buscar.",
  horaTelefono: "11:20",
  banda: "PREVENTIVO",
  perfil: [
    { campo: "Producto", valor: "Crédito productivo ****7715" },
    { campo: "Cuota", valor: "$132.00" },
    { campo: "Vence", valor: "20 de cada mes" },
    { campo: "Ingreso", valor: "Irregular (tienda)" },
    { campo: "Días de atraso", valor: "0 · escribió antes de fallar" },
    { campo: "Distrito", valor: "San Miguel" },
  ],
  disparador: {
    titulo: "Conversación abierta por la persona",
    senal: "Entrante · sin contacto proactivo previo",
    detalle:
      "Nadie la contactó: Rosa escribió primero. Que el canal sea de ida y vuelta importa — una persona siempre puede escribirle al banco, y eso es soporte, no cobranza.",
  },
  fueraDeGuion:
    "Con gusto, Rosa. Para no darte un dato equivocado te paso con una persona del equipo. ¿Te parece?",
  eventos: [
    {
      clase: "marcador",
      espera: 300,
      elemento: {
        clase: "marcador",
        id: "r-cifrado",
        variante: "cifrado",
        texto:
          "Los mensajes están cifrados de extremo a extremo. Bancoagrícola nunca te va a pedir tu PIN ni tu clave por este medio.",
      },
    },
    {
      clase: "marcador",
      espera: 400,
      elemento: { clase: "marcador", id: "r-hoy", variante: "fecha", texto: "Hoy" },
    },
    {
      clase: "cliente",
      espera: 900,
      mensaje: {
        id: "rc1",
        autor: "cliente",
        hora: "11:20 a. m.",
        estado: "leido",
        tipo: "texto",
        texto:
          "Buenas. Fíjese que este mes las ventas están bien bajas y no sé si voy a poder con la cuota completa 😔",
      },
    },
    {
      clase: "agente",
      espera: 600,
      pensando: 2500,
      metricas: { latenciaMs: 1320, tokensIn: 810, tokensOut: 88, validadorOk: true, escalon: 1 },
      pasos: [
        {
          id: "r1",
          tipo: "disparador",
          etiqueta: "Entrante · la persona abrió la conversación",
          detalle: "Sin contacto proactivo. El motor no la había marcado todavía.",
        },
        {
          id: "r2",
          tipo: "tool",
          etiqueta: "consultarCliente()",
          detalle: "cuota $132.00 · vence día 20 · atraso 0 d · ingreso irregular",
        },
        {
          id: "r3",
          tipo: "guardrail",
          etiqueta: "Sin culpa ni juicio",
          detalle: "Avisar antes de fallar se reconoce como lo que es: buena señal.",
        },
        {
          id: "r4",
          tipo: "razonamiento",
          etiqueta: "Todavía no se ofrece nada",
          detalle: "Primero se confirma qué necesita. Ofrecer de entrada sería adivinar.",
        },
      ],
      mensaje: {
        id: "ra1",
        autor: "agente",
        hora: "11:20 a. m.",
        tipo: "botones",
        anotacion: "interactive · button",
        texto:
          "Gracias por avisarme antes, Rosa — eso ayuda un montón y no es poca cosa. Tu cuota es de $132.00 y vence el 20, así que todavía estamos a tiempo.",
        pie: "Nada de esto afecta tu récord",
        botones: [
          { id: "ver_opciones", texto: "Ver mis opciones" },
          { id: "solo_aviso", texto: "Solo quería avisar" },
        ],
      },
    },
    {
      clase: "espera",
      sobre: "ra1",
      accion: { tipo: "boton", botonId: "ver_opciones" },
      pista: "Tocá “Ver mis opciones”",
      autoMs: 2800,
      respuesta: {
        id: "rc2",
        autor: "cliente",
        hora: "11:21 a. m.",
        estado: "leido",
        tipo: "texto",
        texto: "Ver mis opciones",
      },
    },
    {
      clase: "agente",
      espera: 400,
      pensando: 2600,
      metricas: { latenciaMs: 1180, tokensIn: 1040, tokensOut: 92, validadorOk: true, escalon: 5 },
      pasos: [
        {
          id: "r5",
          tipo: "tool",
          etiqueta: "consultarOpcionesValidas()",
          detalle: "La lista sale del motor, no del modelo. Nada fuera de ella existe.",
        },
        {
          id: "r6",
          tipo: "guardrail",
          etiqueta: "Excepción explícita a “una acción por mensaje”",
          detalle: "La persona pidió ver opciones. Fuera de ese caso el agente no despliega menús.",
        },
        {
          id: "r7",
          tipo: "decision",
          etiqueta: "Escalón 5 habilitado por ingreso irregular",
          detalle: "Dividir la cuota aplica; la reestructura no, porque el estrés es estacional.",
        },
      ],
      mensaje: {
        id: "ra2",
        autor: "agente",
        hora: "11:21 a. m.",
        tipo: "lista",
        anotacion: "interactive · list",
        texto:
          "Estas son las que aplican a tu caso hoy. Elegí la que te sirva y te la dejo lista en el momento.",
        pie: "Ninguna tiene costo adicional",
        etiquetaBoton: "Ver opciones",
        secciones: [
          {
            titulo: "Sin costo",
            filas: [
              {
                id: "abono",
                titulo: "Abonar $45.00 el 20",
                descripcion: "Evita el deterioro y el resto queda para el mes siguiente",
              },
              {
                id: "mover",
                titulo: "Mover la fecha al 25",
                descripcion: "Cinco días más, dentro del mismo ciclo",
              },
              {
                id: "dividir",
                titulo: "Dividir la cuota en dos pagos",
                descripcion: "$66.00 el 20 y $66.00 el 5",
              },
            ],
          },
          {
            titulo: "Con una persona",
            filas: [
              { id: "asesor", titulo: "Hablar con un asesor", descripcion: "Te llamamos hoy mismo" },
            ],
          },
        ],
      },
    },
    {
      clase: "espera",
      sobre: "ra2",
      accion: { tipo: "lista", filaId: "dividir" },
      pista: "Abrí la lista y elegí “Dividir la cuota en dos pagos”",
      autoMs: 3600,
      pasos: [
        {
          id: "r8",
          tipo: "tool",
          etiqueta: "registrarAcuerdo({ tipo: “dividir_cuota”, diaAcordado: 20, monto: 66 })",
          detalle: "Acuerdo persistido · segundo pago programado para el 5",
        },
      ],
      respuesta: {
        id: "rc3",
        autor: "cliente",
        hora: "11:22 a. m.",
        estado: "leido",
        tipo: "texto",
        anotacion: "interactive · list_reply",
        texto: "Dividir la cuota en dos pagos",
      },
    },
    {
      clase: "agente",
      espera: 500,
      pensando: 1800,
      metricas: { latenciaMs: 970, tokensIn: 1170, tokensOut: 76, validadorOk: true, escalon: 5 },
      pasos: [
        {
          id: "r9",
          tipo: "guardrail",
          etiqueta: "Monto y fecha explícitos",
          detalle: "“Pagá lo que podás” no es un acuerdo. Un acuerdo tiene número y día.",
        },
      ],
      mensaje: {
        id: "ra3",
        autor: "agente",
        hora: "11:22 a. m.",
        tipo: "texto",
        texto:
          "Listo, Rosa. Quedan dos pagos de $66.00: uno el 20 y otro el 5 del mes que viene. Mismo monto total, sin intereses extra, y tu récord queda intacto.",
      },
    },
    {
      clase: "agente",
      espera: 700,
      pensando: 800,
      metricas: { latenciaMs: 280, tokensIn: 0, tokensOut: 0, validadorOk: true },
      pasos: [
        {
          id: "r10",
          tipo: "registro",
          etiqueta: "Plan adjuntado",
          detalle: "El acuerdo queda por escrito del lado de la persona.",
        },
      ],
      mensaje: {
        id: "ra4",
        autor: "agente",
        hora: "11:22 a. m.",
        tipo: "documento",
        anotacion: "document",
        nombre: "Plan-dos-cuotas-septiembre.pdf",
        paginas: 1,
        peso: "88 kB",
      },
    },
    {
      clase: "marcador",
      espera: 900,
      elemento: {
        clase: "marcador",
        id: "r-cierre",
        variante: "aviso",
        texto: "Acuerdo registrado · dividir cuota · seguimiento el 20",
      },
    },
  ],
};

/* ========================================================================== */
/* Marta — el grupo de control: el sistema se niega a contactar                */
/* ========================================================================== */

const marta: Escenario = {
  slug: "marta",
  nombre: "Marta Cruz",
  etiqueta: "Control · no contactar",
  resumen:
    "Paga adelantado desde hace tres años. El demo la incluye para probar que el motor discrimina de verdad y no manda mensajes a quien no los necesita.",
  horaTelefono: "8:05",
  banda: "SANO",
  perfil: [
    { campo: "Producto", valor: "Crédito de consumo ****2038" },
    { campo: "Cuota", valor: "$154.00" },
    { campo: "Vence", valor: "20 de cada mes" },
    { campo: "Cobra", valor: "15 y 30 (quincenal)" },
    { campo: "Días de atraso", valor: "0 · 36 pagos puntuales" },
    { campo: "Distrito", valor: "Antiguo Cuscatlán" },
  ],
  disparador: {
    titulo: "Ninguna señal activa",
    senal: "36 de 36 pagos puntuales · sin desalineación · sin caída de ingreso",
    detalle:
      "El costo de molestar a un cliente sano no es cero: erosiona la confianza en el canal. El sistema devuelve NO_CONTACTAR y el hilo se queda vacío.",
  },
  fueraDeGuion:
    "Hola Marta, con gusto. Tu crédito está al día y no hay nada pendiente de tu parte. ¿Querés que te pase con alguien del equipo?",
  eventos: [
    {
      clase: "marcador",
      espera: 300,
      elemento: {
        clase: "marcador",
        id: "mc-cifrado",
        variante: "cifrado",
        texto:
          "Los mensajes están cifrados de extremo a extremo. Bancoagrícola nunca te va a pedir tu PIN ni tu clave por este medio.",
      },
    },
    {
      clase: "marcador",
      espera: 1200,
      elemento: {
        clase: "marcador",
        id: "mc-vacio",
        variante: "aviso",
        texto:
          "No hay mensajes. El sistema evaluó a Marta y decidió no escribirle: está al día.",
      },
    },
  ],
};

export const ESCENARIOS: readonly Escenario[] = [karla, wilber, rosa, marta];

export function escenarioPorSlug(slug: string): Escenario {
  return ESCENARIOS.find((e) => e.slug === slug) ?? karla;
}
