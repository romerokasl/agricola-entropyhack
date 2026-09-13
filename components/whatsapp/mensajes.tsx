"use client";

import {
  ChevronRight,
  ExternalLink,
  FileText,
  List,
  MapPin,
  MessageSquare,
  Mic,
  Play,
  Reply,
  User,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Burbuja, Checks, Meta } from "./primitivos";
import type { AccionCliente, BotonRespuesta, Mensaje } from "./types";

/**
 * Un renderizador por tipo de mensaje de la Cloud API.
 *
 * `armado` es la pieza clave del demo en vivo: cuando el guion está esperando que
 * la persona toque algo, ese mensaje —y solo ese— queda interactivo. Así el demo
 * se puede conducir a mano frente al jurado en vez de ser un video.
 */

interface PropsMensaje {
  mensaje: Mensaje;
  conCola: boolean;
  armado: boolean;
  anotar: boolean;
  /** Emoji que el guion espera, cuando la interacción pendiente es una reacción. */
  reaccionSugerida?: string;
  onAccion: (accion: AccionCliente) => void;
}

/* -------------------------------------------------------------------------- */
/* Piezas compartidas                                                          */
/* -------------------------------------------------------------------------- */

/** Botón dentro de la burbuja: separado por línea, texto teal, ancho completo. */
function BotonBurbuja({
  children,
  icono,
  armado,
  onClick,
}: {
  children: ReactNode;
  icono?: ReactNode;
  armado: boolean;
  onClick: () => void;
}) {
  const reducido = useReducedMotion();

  return (
    <motion.button
      type="button"
      disabled={!armado}
      onClick={onClick}
      whileHover={armado && !reducido ? { backgroundColor: "rgba(0,168,132,0.08)" } : undefined}
      whileTap={armado && !reducido ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "flex h-[38px] w-full items-center justify-center gap-1.5 border-t border-wa-divider text-[14px] font-medium text-wa-green",
        armado ? "cursor-pointer" : "cursor-default opacity-70",
      )}
    >
      {icono}
      {children}
      {armado && (
        <motion.span
          aria-hidden
          className="ml-1 block h-[5px] w-[5px] rounded-full bg-wa-green"
          animate={reducido ? undefined : { opacity: [0.25, 1, 0.25], scale: [1, 1.35, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.button>
  );
}

function BloqueCita({ autor, texto }: { autor: string; texto: string }) {
  return (
    <div className="mb-1 flex overflow-hidden rounded-[4px] bg-black/[0.045]">
      <span className="w-1 shrink-0 bg-wa-green" />
      <div className="min-w-0 px-2 py-1">
        <p className="text-[12.5px] font-medium text-wa-green">{autor}</p>
        <p className="truncate text-[12.5px] text-wa-meta">{texto}</p>
      </div>
    </div>
  );
}

/** Texto con el hueco reservado para la hora, tal como lo hace WhatsApp. */
function Cuerpo({ children }: { children: ReactNode }) {
  return <span className="whitespace-pre-wrap break-words">{children}</span>;
}

/**
 * Texto con la hora anclada abajo a la derecha.
 *
 * WhatsApp no flota la hora: la posiciona absoluta al final de la burbuja y
 * reserva el hueco con un espaciador invisible al final del texto. Por eso en un
 * mensaje de tres líneas la hora queda en la tercera y no en la primera. Sin
 * este detalle el chat se lee como un chat genérico, no como WhatsApp.
 */
function CuerpoConHora({
  texto,
  hora,
  estado,
  cita,
}: {
  texto: string;
  hora: string;
  estado?: Mensaje["estado"];
  cita?: ReactNode;
}) {
  return (
    <div className="relative">
      {cita}
      <span className="whitespace-pre-wrap break-words">
        {texto}
        <span
          aria-hidden
          className="inline-block h-[1px]"
          style={{ width: estado ? 68 : 46 }}
        />
      </span>
      <span className="absolute bottom-[-1px] right-0 flex items-center gap-[3px] text-[11px] leading-none text-wa-meta">
        {hora}
        {estado && <Checks estado={estado} />}
      </span>
    </div>
  );
}

function Pie({ texto }: { texto: string }) {
  return <p className="mt-1 text-[12.5px] leading-[16px] text-wa-meta">{texto}</p>;
}

/* -------------------------------------------------------------------------- */
/* Encuesta (poll)                                                             */
/* -------------------------------------------------------------------------- */

function Encuesta({
  pregunta,
  nota,
  opciones,
  votado,
  armado,
  onVotar,
}: {
  pregunta: string;
  nota: string;
  opciones: readonly { id: string; texto: string; votos: number }[];
  votado?: string;
  armado: boolean;
  onVotar: (id: string) => void;
}) {
  const reducido = useReducedMotion();
  const total = opciones.reduce((acc, o) => acc + o.votos, 0);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[15px] font-medium leading-[20px] text-wa-text">{pregunta}</p>
        <p className="mt-0.5 text-[12.5px] text-wa-meta">{nota}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {opciones.map((o) => {
          const elegida = votado === o.id;
          const porcentaje = total > 0 ? o.votos / total : 0;

          return (
            <button
              key={o.id}
              type="button"
              disabled={!armado || votado !== undefined}
              onClick={() => onVotar(o.id)}
              className={cn(
                "flex w-full items-start gap-2.5 text-left",
                armado && votado === undefined ? "cursor-pointer" : "cursor-default",
              )}
            >
              <motion.span
                animate={
                  elegida
                    ? { backgroundColor: "#00a884", borderColor: "#00a884" }
                    : { backgroundColor: "rgba(0,0,0,0)", borderColor: "#8696a0" }
                }
                transition={{ duration: 0.2 }}
                className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]"
              >
                {elegida && (
                  <motion.svg
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5 fill-none stroke-white stroke-[2.2]"
                    initial={reducido ? undefined : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                  >
                    <motion.path d="M2 6.2 4.6 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
                  </motion.svg>
                )}
              </motion.span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[14.2px] leading-[19px] text-wa-text">{o.texto}</span>
                  <span className="shrink-0 text-[12.5px] tabular-nums text-wa-meta">{o.votos}</span>
                </span>
                {/* scaleX en vez de width: es transform, no provoca reflow. */}
                <span className="mt-1.5 block h-[4px] w-full overflow-hidden rounded-full bg-black/10">
                  <motion.span
                    className="block h-full w-full origin-left rounded-full bg-wa-green"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: porcentaje }}
                    transition={
                      reducido
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 120, damping: 20, delay: 0.05 }
                    }
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Adjuntos                                                                    */
/* -------------------------------------------------------------------------- */

function Ubicacion({ nombre, direccion }: { nombre: string; direccion: string }) {
  return (
    <div className="w-full overflow-hidden rounded-[6px]">
      {/* Mapa dibujado: no se embebe un proveedor real en un demo offline. */}
      <div className="relative h-[130px] w-full bg-[#e8e3dc]">
        <svg viewBox="0 0 270 130" className="absolute inset-0 h-full w-full">
          <rect width="270" height="130" fill="#eae5de" />
          <g stroke="#ffffff" strokeWidth="7" strokeLinecap="square">
            <path d="M-10 38h290M-10 96h290M62 -10v150M186 -10v150" />
          </g>
          <g stroke="#d9d3ca" strokeWidth="1">
            <path d="M-10 38h290M-10 96h290M62 -10v150M186 -10v150" />
          </g>
          <g fill="#dfd9d0">
            <rect x="12" y="50" width="38" height="32" rx="2" />
            <rect x="76" y="50" width="42" height="32" rx="2" />
            <rect x="128" y="8" width="44" height="20" rx="2" />
            <rect x="200" y="50" width="46" height="32" rx="2" />
          </g>
          <path d="M62 96h124" stroke="#f6d55c" strokeWidth="8" strokeLinecap="round" />
        </svg>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <MapPin className="h-8 w-8 fill-[#ea4335] text-[#ea4335] drop-shadow" strokeWidth={1.2} />
        </span>
      </div>
      <div className="bg-wa-in px-2.5 py-2">
        <p className="text-[14.2px] font-medium leading-[19px] text-wa-text">{nombre}</p>
        <p className="text-[12.5px] leading-[17px] text-wa-meta">{direccion}</p>
      </div>
    </div>
  );
}

function Documento({
  nombre,
  paginas,
  peso,
}: {
  nombre: string;
  paginas: number;
  peso: string;
}) {
  return (
    <div className="flex w-full items-center gap-2.5 rounded-[6px] bg-black/[0.04] px-2.5 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#e6483d]/10">
        <FileText className="h-5 w-5 text-[#e6483d]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] leading-[19px] text-wa-text">{nombre}</span>
        <span className="mt-0.5 block text-[11.5px] uppercase tracking-wide text-wa-meta">
          {paginas} {paginas === 1 ? "página" : "páginas"} · PDF · {peso}
        </span>
      </span>
    </div>
  );
}

function Audio({ duracion, transcripcion }: { duracion: string; transcripcion?: string }) {
  const reducido = useReducedMotion();
  // Alturas fijas: una waveform aleatoria cambiaría en cada render y en cada demo.
  const barras = [6, 11, 17, 9, 14, 21, 13, 8, 16, 23, 12, 7, 15, 19, 10, 14, 6, 12, 18, 9, 13, 8];

  return (
    <div className="w-full">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wa-green/15">
          <Play className="h-4 w-4 translate-x-[1px] fill-wa-green text-wa-green" />
        </span>
        <span className="flex flex-1 items-center gap-[2px]">
          {barras.map((h, i) => (
            <motion.span
              key={i}
              className="block w-[2px] rounded-full bg-[#9aa5ab]"
              style={{ height: h }}
              animate={reducido ? undefined : { backgroundColor: ["#9aa5ab", "#00a884", "#9aa5ab"] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.06, ease: "easeInOut" }}
            />
          ))}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wa-green/15">
          <Mic className="h-4 w-4 text-wa-green" />
        </span>
      </div>
      <p className="mt-1 text-[11.5px] text-wa-meta">{duracion}</p>
      {transcripcion && (
        <p className="mt-1.5 border-t border-wa-divider pt-1.5 text-[12.5px] italic leading-[17px] text-wa-meta">
          Transcripción: {transcripcion}
        </p>
      )}
    </div>
  );
}

function Contacto({ nombre, rol, telefono }: { nombre: string; rol: string; telefono: string }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2.5 pb-2">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7]">
          <User className="h-6 w-6 text-[#98a5ab]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-medium leading-[19px] text-wa-text">
            {nombre}
          </span>
          <span className="block truncate text-[12.5px] text-wa-meta">{rol}</span>
          <span className="block text-[12.5px] tabular-nums text-wa-meta">{telefono}</span>
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Renderizador principal                                                      */
/* -------------------------------------------------------------------------- */

function Botones({
  botones,
  armado,
  onAccion,
}: {
  botones: readonly BotonRespuesta[];
  armado: boolean;
  onAccion: (a: AccionCliente) => void;
}) {
  return (
    <div className="-mx-[9px] -mb-[8px] mt-1.5">
      {botones.map((b) => (
        <BotonBurbuja
          key={b.id}
          armado={armado}
          icono={<Reply className="h-[15px] w-[15px]" />}
          onClick={() => onAccion({ tipo: "boton", botonId: b.id })}
        >
          {b.texto}
        </BotonBurbuja>
      ))}
    </div>
  );
}

export function RenderMensaje({
  mensaje,
  conCola,
  armado,
  anotar,
  reaccionSugerida,
  onAccion,
}: PropsMensaje) {
  const anotacion = anotar ? mensaje.anotacion : undefined;
  const meta = <Meta hora={mensaje.hora} estado={mensaje.estado} />;
  const cita = mensaje.cita ? <BloqueCita autor={mensaje.cita.autor} texto={mensaje.cita.texto} /> : null;

  const envoltura = (contenido: ReactNode, opciones?: { ancha?: boolean; sinRelleno?: boolean }) => (
    <Burbuja
      autor={mensaje.autor}
      conCola={conCola}
      reaccion={mensaje.reaccion}
      anotacion={anotacion}
      ancha={opciones?.ancha}
      sinRelleno={opciones?.sinRelleno}
      reaccionSugerida={armado ? reaccionSugerida : undefined}
      onReaccionar={
        reaccionSugerida
          ? () => onAccion({ tipo: "reaccion", emoji: reaccionSugerida })
          : undefined
      }
    >
      {contenido}
    </Burbuja>
  );

  switch (mensaje.tipo) {
    case "texto":
      return envoltura(
        <CuerpoConHora
          texto={mensaje.texto}
          hora={mensaje.hora}
          estado={mensaje.estado}
          cita={cita}
        />,
      );

    case "plantilla":
      return envoltura(
        <>
          {mensaje.encabezado && (
            <p className="mb-1 text-[15px] font-semibold leading-[20px] text-wa-text">
              {mensaje.encabezado}
            </p>
          )}
          {mensaje.botones || mensaje.pie ? (
            <Cuerpo>{mensaje.texto}</Cuerpo>
          ) : (
            <CuerpoConHora texto={mensaje.texto} hora={mensaje.hora} estado={mensaje.estado} />
          )}
          {mensaje.pie && <Pie texto={mensaje.pie} />}
          {!mensaje.botones && mensaje.pie && <div className="mt-0.5 flex justify-end">{meta}</div>}
          {mensaje.botones && (
            <>
              <div className="mt-0.5 flex justify-end">{meta}</div>
              <Botones botones={mensaje.botones} armado={armado} onAccion={onAccion} />
            </>
          )}
        </>,
        { ancha: true },
      );

    case "botones":
      return envoltura(
        <>
          {cita}
          <Cuerpo>{mensaje.texto}</Cuerpo>
          {mensaje.pie && <Pie texto={mensaje.pie} />}
          <div className="mt-0.5 flex justify-end">{meta}</div>
          <Botones botones={mensaje.botones} armado={armado} onAccion={onAccion} />
        </>,
        { ancha: true },
      );

    case "lista":
      return envoltura(
        <>
          <Cuerpo>{mensaje.texto}</Cuerpo>
          {mensaje.pie && <Pie texto={mensaje.pie} />}
          <div className="mt-0.5 flex justify-end">{meta}</div>
          <div className="-mx-[9px] -mb-[8px] mt-1.5">
            <BotonBurbuja
              armado={armado}
              icono={<List className="h-[15px] w-[15px]" />}
              onClick={() => onAccion({ tipo: "lista", filaId: "__abrir__" })}
            >
              {mensaje.etiquetaBoton}
            </BotonBurbuja>
          </div>
        </>,
        { ancha: true },
      );

    case "cta":
      return envoltura(
        <>
          <Cuerpo>{mensaje.texto}</Cuerpo>
          {mensaje.pie && <Pie texto={mensaje.pie} />}
          <div className="mt-0.5 flex justify-end">{meta}</div>
          <div className="-mx-[9px] -mb-[8px] mt-1.5">
            <BotonBurbuja
              armado={armado}
              icono={<ExternalLink className="h-[15px] w-[15px]" />}
              onClick={() => onAccion({ tipo: "cta" })}
            >
              {mensaje.etiquetaBoton}
            </BotonBurbuja>
          </div>
        </>,
        { ancha: true },
      );

    case "flujo":
      return envoltura(
        <>
          <Cuerpo>{mensaje.texto}</Cuerpo>
          {mensaje.pie && <Pie texto={mensaje.pie} />}
          <div className="mt-0.5 flex justify-end">{meta}</div>
          <div className="-mx-[9px] -mb-[8px] mt-1.5">
            <BotonBurbuja
              armado={armado}
              icono={<ChevronRight className="h-[15px] w-[15px]" />}
              onClick={() => onAccion({ tipo: "flujo", resumen: "__abrir__" })}
            >
              {mensaje.etiquetaBoton}
            </BotonBurbuja>
          </div>
        </>,
        { ancha: true },
      );

    case "encuesta":
      return envoltura(
        <>
          <Encuesta
            pregunta={mensaje.pregunta}
            nota={mensaje.nota}
            opciones={mensaje.opciones}
            votado={mensaje.votado}
            armado={armado}
            onVotar={(id) => onAccion({ tipo: "encuesta", opcionId: id })}
          />
          <div className="mt-1 flex justify-end">{meta}</div>
        </>,
        { ancha: true },
      );

    case "ubicacion":
      return envoltura(
        <div className="relative">
          <Ubicacion nombre={mensaje.nombre} direccion={mensaje.direccion} />
          <span className="absolute bottom-1.5 right-2 flex items-center gap-[3px] rounded-full bg-black/35 px-1.5 py-[1px] text-[11px] text-white">
            {mensaje.hora}
          </span>
        </div>,
        { sinRelleno: true, ancha: true },
      );

    case "documento":
      return envoltura(
        <>
          <Documento nombre={mensaje.nombre} paginas={mensaje.paginas} peso={mensaje.peso} />
          <div className="mt-0.5 flex justify-end">{meta}</div>
        </>,
        { ancha: true },
      );

    case "audio":
      return envoltura(
        <>
          <Audio duracion={mensaje.duracion} transcripcion={mensaje.transcripcion} />
          <div className="mt-0.5 flex justify-end">{meta}</div>
        </>,
        { ancha: true },
      );

    case "contacto":
      return envoltura(
        <>
          <Contacto nombre={mensaje.nombre} rol={mensaje.rol} telefono={mensaje.telefono} />
          <div className="flex justify-end">{meta}</div>
          <div className="-mx-[9px] -mb-[8px] mt-1.5">
            <BotonBurbuja
              armado={armado}
              icono={<MessageSquare className="h-[15px] w-[15px]" />}
              onClick={() => onAccion({ tipo: "boton", botonId: "escribir_asesor" })}
            >
              Enviar mensaje
            </BotonBurbuja>
          </div>
        </>,
      );
  }
}
