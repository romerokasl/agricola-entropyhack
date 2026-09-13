/**
 * Tipos del canal WhatsApp.
 *
 * No son inventados: cada variante corresponde a un tipo de mensaje real de la
 * WhatsApp Business Cloud API. El demo es simulado (no hay Meta detrás), pero la
 * forma de los datos es la que tendría producción, así que migrar de este mock a
 * la API real es cambiar el transporte, no el modelo.
 *
 *   texto       → messages/text
 *   plantilla   → messages/template            (el único tipo que permite abrir
 *                                               conversación fuera de la ventana
 *                                               de 24 h — o sea, el disparador)
 *   botones     → interactive/button           (máx. 3 botones, 20 chars c/u)
 *   lista       → interactive/list             (máx. 10 filas)
 *   cta         → interactive/cta_url
 *   flujo       → interactive/flow             (WhatsApp Flows: formulario nativo)
 *   encuesta    → poll
 *   ubicacion   → messages/location
 *   documento   → messages/document
 *   audio       → messages/audio               (nota de voz)
 *   contacto    → messages/contacts
 */

/** Los checks. Solo aparecen en los mensajes que manda el dueño del teléfono. */
export type EstadoEntrega = "enviando" | "enviado" | "entregado" | "leido";

/** Quién habla. `cliente` es el dueño del teléfono: sus burbujas van a la derecha. */
export type Autor = "agente" | "cliente";

/** Categorías de plantilla de Meta. Cobranza preventiva es `utility`, nunca `marketing`. */
export type CategoriaPlantilla = "utility" | "marketing" | "authentication";

export interface BotonRespuesta {
  id: string;
  /** Meta lo limita a 20 caracteres. El validador de plantillas lo verifica. */
  texto: string;
}

export interface FilaLista {
  id: string;
  titulo: string;
  descripcion?: string;
}

export interface SeccionLista {
  titulo: string;
  filas: readonly FilaLista[];
}

export interface OpcionEncuesta {
  id: string;
  texto: string;
  votos: number;
}

export type CampoFlujo =
  | { tipo: "info"; id: string; etiqueta: string; valor: string }
  | {
      tipo: "opcion";
      id: string;
      etiqueta: string;
      opciones: readonly { id: string; etiqueta: string; nota?: string }[];
    };

export interface DefinicionFlujo {
  titulo: string;
  subtitulo: string;
  campos: readonly CampoFlujo[];
  etiquetaEnvio: string;
}

interface BaseMensaje {
  id: string;
  autor: Autor;
  /** Formato corto, como lo muestra WhatsApp: "9:41 a. m." */
  hora: string;
  estado?: EstadoEntrega;
  /** Emoji de reacción sobre la burbuja. */
  reaccion?: string;
  /** Bloque de cita cuando se responde a un mensaje anterior. */
  cita?: { autor: string; texto: string };
  /** Etiqueta que se muestra solo en "modo inspección": el tipo de la API real. */
  anotacion?: string;
}

export type Mensaje = BaseMensaje &
  (
    | { tipo: "texto"; texto: string }
    | {
        tipo: "plantilla";
        categoria: CategoriaPlantilla;
        nombrePlantilla: string;
        encabezado?: string;
        texto: string;
        pie?: string;
        botones?: readonly BotonRespuesta[];
      }
    | { tipo: "botones"; texto: string; pie?: string; botones: readonly BotonRespuesta[] }
    | {
        tipo: "lista";
        texto: string;
        pie?: string;
        etiquetaBoton: string;
        secciones: readonly SeccionLista[];
      }
    | { tipo: "cta"; texto: string; pie?: string; etiquetaBoton: string; url: string }
    | { tipo: "flujo"; texto: string; pie?: string; etiquetaBoton: string; flujo: DefinicionFlujo }
    | {
        tipo: "encuesta";
        pregunta: string;
        nota: string;
        opciones: readonly OpcionEncuesta[];
        /** Opción ya votada por el dueño del teléfono. */
        votado?: string;
      }
    | { tipo: "ubicacion"; nombre: string; direccion: string }
    | { tipo: "documento"; nombre: string; paginas: number; peso: string }
    | { tipo: "audio"; duracion: string; transcripcion?: string }
    | { tipo: "contacto"; nombre: string; rol: string; telefono: string }
  );

/** Las líneas de sistema del hilo: cifrado, divisor de fecha, avisos. */
export interface Marcador {
  clase: "marcador";
  id: string;
  variante: "cifrado" | "fecha" | "aviso";
  texto: string;
}

export type ElementoHilo = ({ clase: "mensaje" } & Mensaje) | Marcador;

/** Acción del dueño del teléfono sobre un mensaje interactivo del agente. */
export type AccionCliente =
  | { tipo: "boton"; botonId: string }
  | { tipo: "lista"; filaId: string }
  | { tipo: "encuesta"; opcionId: string }
  | { tipo: "flujo"; resumen: string }
  | { tipo: "cta" }
  | { tipo: "reaccion"; emoji: string };
