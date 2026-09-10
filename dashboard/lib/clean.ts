// Limpieza de datos viejos scrapeados que traen glifos de íconos de Google Maps
// (caracteres del área de uso privado) pegados al teléfono o al domicilio.

const GLYPHS = /[\u{E000}-\u{F8FF}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

export function stripGlyphs(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(GLYPHS, "").replace(/\s+/g, " ").trim();
}

export function cleanPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const low = raw.toLowerCase();
  if (low.includes("enviar al tel") || low.includes("send to phone")) return "";
  const m = raw.match(/[+\d][\d\s().\-]{6,}/);
  return m ? m[0].trim() : "";
}

// Extrae el número nacional de 10 dígitos (México), tolerando todas las
// variantes con que se haya guardado: 10 (nacional), 11 (1+10),
// 12 (52+10) y 13 (521+10). Así todos quedan IGUALES.
function national10(raw: string | null | undefined): string {
  let d = cleanPhone(raw).replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("521")) d = d.slice(3);          // +52 1 + 10 (móvil)
  else if (d.length === 13 && (d.startsWith("044") || d.startsWith("045"))) d = d.slice(3); // viejo móvil
  else if (d.length === 12 && d.startsWith("52")) d = d.slice(2);      // 52 + 10
  else if (d.length === 12 && d.startsWith("01")) d = d.slice(2);      // viejo larga distancia
  else if (d.length === 11 && d.startsWith("1")) d = d.slice(1);       // 1 + 10
  // NO adivinar recortando: si no quedó en 10, se deja tal cual para no
  // CAMBIAR el número (mejor verlo raro que verlo cambiado).
  return d;
}

// Número internacional para MARCAR (tel:), siempre "+52" + 10 dígitos.
export function phoneTel(raw: string | null | undefined): string {
  const n = national10(raw);
  if (n.length === 10) return "+52" + n;
  const d = cleanPhone(raw).replace(/\D/g, "");
  return d ? "+" + d : ""; // fallback para números no estándar
}

// Número para WhatsApp (wa.me): dígitos con país, SIN "+". Ej. "523336133523".
export function phoneWa(raw: string | null | undefined): string {
  return phoneTel(raw).replace(/\D/g, "");
}

// Mostrar el teléfono TAL CUAL viene en la ficha (solo limpio de íconos/etiquetas).
// No se reformatea ni se agrega lada: el +52 solo se usa para llamar/WhatsApp.
export function phoneDisplay(raw: string | null | undefined): string {
  return cleanPhone(raw);
}

export function phoneDisplayShort(raw: string | null | undefined): string {
  return cleanPhone(raw);
}

// ── Dominio legible del sitio web ───────────────────────────────────────────
// Para mostrar "facebook.com" en vez del link largo completo.
export function siteHost(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim();
  if (!s) return "";
  try {
    const url = new URL(s.includes("//") ? s : `https://${s}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}
