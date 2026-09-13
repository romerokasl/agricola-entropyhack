"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  ChevronDown,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Send,
  Smile,
  Video,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { RenderMensaje } from "./mensajes";
import { BarraEstado, Escribiendo, Marcador } from "./primitivos";
import type { AccionCliente, ElementoHilo, Mensaje } from "./types";

/**
 * El canal completo: barra de estado, encabezado, hilo, hojas inferiores y
 * barra de escritura. Es puramente presentacional — no hace fetch ni conoce el
 * guion. Quien lo alimenta decide si los mensajes vienen de un script o de
 * /api/chat, y por eso esta misma pieza sirve para el demo y para producción.
 */

export interface PropsHilo {
  elementos: readonly ElementoHilo[];
  escribiendo: boolean;
  /** Id del único mensaje interactivo habilitado ahora mismo. */
  idArmado: string | null;
  /** Emoji esperado cuando la interacción pendiente es una reacción rápida. */
  reaccionSugerida?: string;
  /** Modo inspección: muestra el tipo de la Cloud API sobre cada burbuja. */
  anotar: boolean;
  nombreContacto: string;
  horaTelefono: string;
  onAccion: (idMensaje: string, accion: AccionCliente) => void;
  onEnviarTexto: (texto: string) => void;
}

/* -------------------------------------------------------------------------- */
/* Encabezado                                                                  */
/* -------------------------------------------------------------------------- */

function Encabezado({ nombre, escribiendo }: { nombre: string; escribiendo: boolean }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 bg-wa-teal px-2.5 text-white">
      <ArrowLeft className="h-5 w-5 shrink-0 opacity-90" />
      {/* Avatar del contacto. Fondo blanco: el logo real es negro sobre transparente. */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-[7px]">
        <img
          src="/bancoagricola_blackfont_logo.svg"
          alt="Bancoagrícola"
          className="h-full w-full object-contain"
        />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="flex items-center gap-1 truncate text-[15.5px] font-medium">
          {nombre}
          <BadgeCheck className="h-[15px] w-[15px] shrink-0 fill-white/95 text-wa-teal" />
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={escribiendo ? "escribiendo" : "empresa"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="truncate text-[12.5px] text-white/80"
          >
            {escribiendo ? "escribiendo…" : "cuenta de empresa · en línea"}
          </motion.p>
        </AnimatePresence>
      </div>
      <Video className="h-[19px] w-[19px] shrink-0 opacity-90" />
      <Phone className="h-[17px] w-[17px] shrink-0 opacity-90" />
      <MoreVertical className="h-[19px] w-[19px] shrink-0 opacity-90" />
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Hoja inferior: mensaje de lista                                             */
/* -------------------------------------------------------------------------- */

function HojaLista({
  mensaje,
  onCerrar,
  onElegir,
}: {
  mensaje: Extract<Mensaje, { tipo: "lista" }>;
  onCerrar: () => void;
  onElegir: (filaId: string) => void;
}) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[78%] overflow-hidden rounded-t-2xl bg-white"
    >
      <div className="flex items-center justify-between border-b border-wa-divider px-4 py-3">
        <p className="text-[16px] font-medium text-wa-text">{mensaje.etiquetaBoton}</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar">
          <X className="h-5 w-5 text-wa-meta" />
        </button>
      </div>

      <div className="wa-scroll max-h-[calc(78vh-3.5rem)] overflow-y-auto pb-3">
        {mensaje.secciones.map((seccion) => (
          <div key={seccion.titulo}>
            <p className="px-4 pb-1 pt-3 text-[13px] font-medium uppercase tracking-wide text-wa-green">
              {seccion.titulo}
            </p>
            {seccion.filas.map((fila) => (
              <motion.button
                key={fila.id}
                type="button"
                whileTap={{ backgroundColor: "rgba(0,0,0,0.05)" }}
                onClick={() => onElegir(fila.id)}
                className="flex w-full items-start gap-3 border-b border-wa-divider px-4 py-3 text-left last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] leading-[19px] text-wa-text">
                    {fila.titulo}
                  </span>
                  {fila.descripcion && (
                    <span className="mt-0.5 block text-[13px] leading-[17px] text-wa-meta">
                      {fila.descripcion}
                    </span>
                  )}
                </span>
                <span className="mt-[3px] h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-[#8696a0]" />
              </motion.button>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hoja inferior: WhatsApp Flow                                                */
/* -------------------------------------------------------------------------- */

function HojaFlujo({
  mensaje,
  onCerrar,
  onEnviar,
}: {
  mensaje: Extract<Mensaje, { tipo: "flujo" }>;
  onCerrar: () => void;
  onEnviar: (resumen: string) => void;
}) {
  const campoOpcion = mensaje.flujo.campos.find((c) => c.tipo === "opcion");
  const [elegida, setElegida] = useState<string | null>(
    campoOpcion && campoOpcion.tipo === "opcion" ? campoOpcion.opciones[0].id : null,
  );

  const etiquetaElegida =
    campoOpcion && campoOpcion.tipo === "opcion"
      ? campoOpcion.opciones.find((o) => o.id === elegida)?.etiqueta
      : undefined;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="absolute inset-x-0 bottom-0 z-30 flex h-[86%] flex-col overflow-hidden rounded-t-2xl bg-white"
    >
      <div className="flex items-center gap-3 border-b border-wa-divider px-4 py-3">
        <button type="button" onClick={onCerrar} aria-label="Cerrar">
          <X className="h-5 w-5 text-wa-meta" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-medium text-wa-text">{mensaje.flujo.titulo}</p>
          <p className="truncate text-[12px] text-wa-meta">{mensaje.flujo.subtitulo}</p>
        </div>
      </div>

      <div className="wa-scroll flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
        {mensaje.flujo.campos.map((campo) => {
          if (campo.tipo === "info") {
            return (
              <div key={campo.id} className="flex items-baseline justify-between gap-4">
                <span className="text-[13.5px] text-wa-meta">{campo.etiqueta}</span>
                <span className="text-[14.5px] font-medium text-wa-text">{campo.valor}</span>
              </div>
            );
          }

          return (
            <fieldset key={campo.id} className="flex flex-col gap-2">
              <legend className="pb-1 text-[13.5px] font-medium text-wa-text">
                {campo.etiqueta}
              </legend>
              {campo.opciones.map((opcion) => {
                const activa = elegida === opcion.id;
                return (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setElegida(opcion.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      activa ? "border-wa-green bg-wa-green/5" : "border-wa-divider bg-white",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
                        activa ? "border-wa-green" : "border-[#8696a0]",
                      )}
                    >
                      {activa && (
                        <motion.span
                          layoutId="punto-flujo"
                          className="block h-[10px] w-[10px] rounded-full bg-wa-green"
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14.5px] leading-[19px] text-wa-text">
                        {opcion.etiqueta}
                      </span>
                      {opcion.nota && (
                        <span className="mt-0.5 block text-[12.5px] leading-[17px] text-wa-meta">
                          {opcion.nota}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </fieldset>
          );
        })}
      </div>

      <div className="border-t border-wa-divider px-4 pb-4 pt-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          onClick={() => onEnviar(etiquetaElegida ?? mensaje.flujo.etiquetaEnvio)}
          className="h-11 w-full rounded-full bg-wa-green text-[15px] font-medium text-white"
        >
          {mensaje.flujo.etiquetaEnvio}
        </motion.button>
        <p className="mt-2 text-center text-[11.5px] text-wa-meta">
          Administrado por Bancoagrícola · cifrado de extremo a extremo
        </p>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Barra de escritura                                                          */
/* -------------------------------------------------------------------------- */

function Composer({ onEnviar }: { onEnviar: (texto: string) => void }) {
  const [borrador, setBorrador] = useState("");
  const hayTexto = borrador.trim().length > 0;

  const enviar = () => {
    if (!hayTexto) return;
    onEnviar(borrador.trim());
    setBorrador("");
  };

  return (
    // Es un <form> y no un <div> para que Enter envíe de forma nativa, sin
    // depender de un handler de teclado que puede no dispararse en todos lados.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      className="flex shrink-0 items-end gap-1.5 bg-wa-composer px-2 py-2"
    >
      <div className="flex min-h-[42px] min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 py-2">
        <Smile className="h-[22px] w-[22px] shrink-0 text-[#8696a0]" />
        <input
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          placeholder="Escribe un mensaje"
          aria-label="Escribe un mensaje"
          className="w-full min-w-0 flex-1 bg-transparent text-[15px] text-wa-text outline-none placeholder:text-[#8696a0]"
        />
        <Paperclip className="h-[21px] w-[21px] shrink-0 -rotate-45 text-[#8696a0]" />
        {!hayTexto && <Camera className="h-[21px] w-[21px] shrink-0 text-[#8696a0]" />}
      </div>

      <motion.button
        type="submit"
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 420, damping: 25 }}
        aria-label={hayTexto ? "Enviar" : "Grabar nota de voz"}
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-wa-green text-white"
      >
        <AnimatePresence mode="wait" initial={false}>
          {hayTexto ? (
            <motion.span
              key="enviar"
              initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <Send className="h-5 w-5 translate-x-[1px]" />
            </motion.span>
          ) : (
            <motion.span
              key="mic"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <Mic className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Hilo                                                                        */
/* -------------------------------------------------------------------------- */

export function HiloWhatsapp({
  elementos,
  escribiendo,
  idArmado,
  reaccionSugerida,
  anotar,
  nombreContacto,
  horaTelefono,
  onAccion,
  onEnviarTexto,
}: PropsHilo) {
  const reducido = useReducedMotion();
  const viewport = useRef<HTMLDivElement>(null);
  const [pegadoAlFinal, setPegadoAlFinal] = useState(true);
  const [lista, setLista] = useState<Extract<Mensaje, { tipo: "lista" }> | null>(null);
  const [flujo, setFlujo] = useState<Extract<Mensaje, { tipo: "flujo" }> | null>(null);

  useEffect(() => {
    if (!pegadoAlFinal) return;
    const nodo = viewport.current;
    if (!nodo) return;
    nodo.scrollTo({ top: nodo.scrollHeight, behavior: reducido ? "auto" : "smooth" });
  }, [elementos, escribiendo, pegadoAlFinal, reducido]);

  const alScrollear = () => {
    const nodo = viewport.current;
    if (!nodo) return;
    const distancia = nodo.scrollHeight - nodo.scrollTop - nodo.clientHeight;
    setPegadoAlFinal(distancia < 60);
  };

  /** Intercepta las acciones que abren una hoja; el resto sube al guion. */
  const manejarAccion = (mensaje: Mensaje, accion: AccionCliente) => {
    if (accion.tipo === "lista" && accion.filaId === "__abrir__" && mensaje.tipo === "lista") {
      setLista(mensaje);
      return;
    }
    if (accion.tipo === "flujo" && accion.resumen === "__abrir__" && mensaje.tipo === "flujo") {
      setFlujo(mensaje);
      return;
    }
    onAccion(mensaje.id, accion);
  };

  let autorPrevio: string | null = null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-wa-paper">
      <BarraEstado hora={horaTelefono} />
      <Encabezado nombre={nombreContacto} escribiendo={escribiendo} />

      <div
        ref={viewport}
        onScroll={alScrollear}
        className="wa-scroll wa-wallpaper relative flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
      >
        <div className="flex flex-col gap-[3px] pb-2">
          {elementos.map((elemento) => {
            if (elemento.clase === "marcador") {
              autorPrevio = null;
              return (
                <Marcador key={elemento.id} variante={elemento.variante} texto={elemento.texto} />
              );
            }

            const conCola = autorPrevio !== elemento.autor;
            autorPrevio = elemento.autor;

            return (
              <div key={elemento.id} className={cn(conCola && "mt-2 first:mt-0")}>
                <RenderMensaje
                  mensaje={elemento}
                  conCola={conCola}
                  armado={idArmado === elemento.id}
                  reaccionSugerida={reaccionSugerida}
                  anotar={anotar}
                  onAccion={(accion) => manejarAccion(elemento, accion)}
                />
              </div>
            );
          })}

          <AnimatePresence>{escribiendo && <Escribiendo key="escribiendo" />}</AnimatePresence>
        </div>
      </div>

      {/* Botón de "ir al final", como el del cliente real. */}
      <AnimatePresence>
        {!pegadoAlFinal && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.7, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 8 }}
            onClick={() => setPegadoAlFinal(true)}
            aria-label="Ir al último mensaje"
            className="absolute bottom-[68px] right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-wa-meta shadow-md"
          >
            <ChevronDown className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <Composer onEnviar={onEnviarTexto} />

      {/* Hojas inferiores */}
      <AnimatePresence>
        {(lista || flujo) && (
          <motion.button
            type="button"
            key="velo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Cerrar"
            onClick={() => {
              setLista(null);
              setFlujo(null);
            }}
            className="absolute inset-0 z-20 cursor-default bg-black/40"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lista && (
          <HojaLista
            key="hoja-lista"
            mensaje={lista}
            onCerrar={() => setLista(null)}
            onElegir={(filaId) => {
              const actual = lista;
              setLista(null);
              onAccion(actual.id, { tipo: "lista", filaId });
            }}
          />
        )}
        {flujo && (
          <HojaFlujo
            key="hoja-flujo"
            mensaje={flujo}
            onCerrar={() => setFlujo(null)}
            onEnviar={(resumen) => {
              const actual = flujo;
              setFlujo(null);
              onAccion(actual.id, { tipo: "flujo", resumen });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
