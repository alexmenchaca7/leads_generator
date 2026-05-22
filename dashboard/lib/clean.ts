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
