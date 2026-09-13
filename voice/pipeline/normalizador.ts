/**
 * Normalizador fonético: convierte el texto **escrito** en el texto que se **pronuncia**.
 *
 * Es una ventaja estructural de la cascada sobre speech-to-speech, no un detalle
 * cosmético: existe un paso de texto intermedio donde intervenir antes de sintetizar.
 * Un modelo S2S no tiene dónde hacerlo porque nunca hay texto que corregir
 * (`docs/criterios-comparacion-voz.md`, Dimensión 4.2).
 *
 * Dónde corre, y el orden importa:
 *
 *     validador → se persiste el texto ESCRITO → normalizador → TTS
 *
 * Lo que queda en `turnos` y ve el jurado es la forma escrita. Lo que suena es esta
 * otra. El normalizador es fonético: **nunca puede cambiar el contenido** que el
 * validador aprobó — solo cómo se lee.
 *
 * Por qué los montos son el caso central: el mensaje de cierre siempre menciona el
 * monto y la fecha del acuerdo, así que "$145.00" y "el 16" aparecen en el turno más
 * importante de cada conversación.
 *
 * Alcance deliberado: solo transformaciones que son inequívocas como texto (números a
 * palabras). No incluye trucos de pronunciación para un motor de TTS específico, que no
 * se pueden verificar sin escucharlos.
 */

const UNIDADES = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];

const DECENAS = [
  "", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa",
];

const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

/** Entero a palabras. Cubre 0–999,999, de sobra para cuotas, saldos y días. */
export function enPalabras(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  const entero = Math.floor(n);

  if (entero < 30) return UNIDADES[entero];

  if (entero < 100) {
    const resto = entero % 10;
    const decena = DECENAS[Math.floor(entero / 10)];
    return resto === 0 ? decena : `${decena} y ${UNIDADES[resto]}`;
  }

  if (entero === 100) return "cien";

  if (entero < 1000) {
    const resto = entero % 100;
    const centena = CENTENAS[Math.floor(entero / 100)];
    return resto === 0 ? centena : `${centena} ${enPalabras(resto)}`;
  }

  if (entero < 1_000_000) {
    const miles = Math.floor(entero / 1000);
    const resto = entero % 1000;
    const prefijo = miles === 1 ? "mil" : `${enPalabras(miles)} mil`;
    return resto === 0 ? prefijo : `${prefijo} ${enPalabras(resto)}`;
  }

  return String(entero);
}

/**
 * Apócope delante de sustantivo masculino: "un dólar", no "uno dólar"; "veintiún
 * dólares", no "veintiuno dólares". Solo aplica a montos — "el día veintiuno" se dice
 * entero, así que los números sueltos no pasan por acá.
 */
function apocopar(palabras: string): string {
  if (palabras.endsWith("veintiuno")) return `${palabras.slice(0, -"veintiuno".length)}veintiún`;
  if (palabras.endsWith("uno")) return `${palabras.slice(0, -"uno".length)}un`;
  return palabras;
}

function montoEnPalabras(entero: number, centavos: number): string {
  const partes: string[] = [];

  if (entero > 0) {
    partes.push(`${apocopar(enPalabras(entero))} ${entero === 1 ? "dólar" : "dólares"}`);
  }

  if (centavos > 0) {
    const texto = `${apocopar(enPalabras(centavos))} ${centavos === 1 ? "centavo" : "centavos"}`;
    partes.push(partes.length > 0 ? `con ${texto}` : texto);
  }

  // "$0.00" no debería existir en una conversación de cobranza, pero si llega, que se
  // lea como algo en vez de desaparecer.
  if (partes.length === 0) return "cero dólares";

  return partes.join(" ");
}

const RE_MONTO = /\$\s?(\d[\d,]*)(?:\.(\d{1,2}))?/g;
const RE_PORCENTAJE = /(\d+)\s?%/g;
const RE_ENTERO = /\d+/g;

/**
 * Devuelve el texto listo para el TTS. Idempotente en la práctica: aplicarlo dos veces
 * no cambia el resultado, porque después de la primera pasada ya no quedan dígitos.
 */
export function normalizarParaVoz(texto: string): string {
  let salida = texto.replace(RE_MONTO, (_todo, enteroCrudo: string, centavosCrudo?: string) => {
    const entero = Number(enteroCrudo.replace(/,/g, ""));
    const centavos = centavosCrudo ? Number(centavosCrudo.padEnd(2, "0")) : 0;
    return montoEnPalabras(entero, centavos);
  });

  salida = salida.replace(RE_PORCENTAJE, (_todo, n: string) => `${enPalabras(Number(n))} por ciento`);

  // Lo que quede suelto son días, plazos y cantidades: "el 16" → "el dieciséis".
  salida = salida.replace(RE_ENTERO, (n) => enPalabras(Number(n)));

  // En El Salvador el DUI se pronuncia como palabra, no deletreado.
  salida = salida.replace(/\bDUI\b/g, "dui");

  return salida;
}
