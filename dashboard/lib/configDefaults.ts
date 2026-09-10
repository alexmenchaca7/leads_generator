import type { AppConfig } from "@/types";

// ============================================================================
//  Valores por defecto de la configuración — ESPEJO de config.py del scraper.
//  Si cambias config.py, refleja el cambio aquí (y al revés). app_config en
//  Supabase sobreescribe estos valores; lo que falte usa estos defaults.
// ============================================================================
export const DEFAULT_CONFIG: AppConfig = {
  search_queries: [
    "dentista en Guadalajara",
    "clínica dental en Zapopan",
    "consultorio médico en Guadalajara",
    "veterinaria en Zapopan",
    "spa en Guadalajara",
    "estética en Tlaquepaque",
    "barbería en Guadalajara",
    "despacho de abogados en Guadalajara",
    "contador público en Zapopan",
    "agencia de seguros en Guadalajara",
    "inmobiliaria en Zapopan",
    "restaurante en Guadalajara",
    "cafetería en Zapopan",
    "hotel en Tlaquepaque",
    "salón de eventos en Guadalajara",
    "gimnasio en Guadalajara",
    "estudio de yoga en Zapopan",
    "mueblería en Guadalajara",
    "boutique de ropa en Zapopan",
    "taller mecánico en Tonalá",
  ],
  target_industries: [
    { keywords: ["dentist", "dental", "ortodon", "endodon"], label: "Dental" },
    { keywords: ["médic", "medic", "consultorio", "clínic", "clinic", "doctor", "pediatr", "dermatól", "dermatolog", "nutriólog", "nutriolog", "psicólog", "psicolog"], label: "Salud / Consultorio" },
    { keywords: ["veterinar", "mascota"], label: "Veterinaria" },
    { keywords: ["spa", "estétic", "estetic", "belleza", "uñas", "barber", "peluquer"], label: "Belleza / Spa" },
    { keywords: ["abogad", "jurídic", "juridic", "notar", "legal"], label: "Abogados" },
    { keywords: ["contad", "contabil", "fiscal"], label: "Contadores" },
    { keywords: ["seguro", "asegurad", "afianzad"], label: "Seguros" },
    { keywords: ["inmobiliar", "bienes raíces", "bienes raices"], label: "Inmobiliaria" },
    { keywords: ["restaurant", "taquer", "marisquer", "cocina", "comida", "pizzer", "sushi"], label: "Restaurante" },
    { keywords: ["cafeter", "café", "coffee", "reposter", "panader"], label: "Cafetería / Panadería" },
    { keywords: ["hotel", "hostal", "motel", "posada"], label: "Hotel" },
    { keywords: ["salón de eventos", "salon de eventos", "banquete", "eventos", "boda"], label: "Eventos" },
    { keywords: ["gimnasio", "gym", "crossfit", "yoga", "pilates"], label: "Gimnasio / Fitness" },
    { keywords: ["escuela", "colegio", "academia", "instituto", "capacitac", "curso"], label: "Educación" },
    { keywords: ["mueble", "mueblería", "muebleria", "decorac"], label: "Muebles / Decoración" },
    { keywords: ["boutique", "ropa", "tienda", "zapater", "joyer"], label: "Comercio / Retail" },
    { keywords: ["taller", "automotriz", "mecánic", "mecanic", "hojalat", "refaccion", "llanter"], label: "Automotriz" },
    { keywords: ["arquitect", "constructora", "construc", "remodelac"], label: "Arquitectura / Construcción" },
    { keywords: ["fotograf", "publicidad", "marketing", "impren", "rotulac"], label: "Creativos / Publicidad" },
  ],
  social_domains: [
    "facebook.com", "fb.com", "fb.me", "instagram.com", "tiktok.com",
    "twitter.com", "youtube.com", "linkedin.com", "pinterest.com",
    "wa.me", "whatsapp.com", "linktr.ee", "linktree", "beacons.ai",
    "bio.link", "campsite.bio", "msng.link",
    "business.site", "negocio.site", "sites.google.com", "google.com/maps",
    "wixsite.com", "blogspot.com", "wordpress.com", "weebly.com",
    "jimdosite.com", "godaddysites.com", "mystrikingly.com", "carrd.co",
    "mercadolibre.com", "amazon.com", "doctoralia.com", "ubereats.com",
    "rappi.com", "didifood", "booking.com", "airbnb.com", "tripadvisor",
  ],
  scoring_weights: {
    no_website: 40,
    only_social: 28,
    target_industry: 15,
    reviews_high: 15,
    reviews_medium: 10,
    reviews_low: 5,
    rating_excellent: 8,
    rating_good: 4,
    has_phone: 10,
  },
  priority_thresholds: { high: 60, medium: 35 },
  dropdown_options: {
    outreach_status: ["pendiente", "contactado", "no contestó", "interesado", "no interesado", "cliente"],
    contacted: ["sí", "no"],
    deal_status: ["prospecto", "negociando", "ganado", "perdido"],
  },
  scraper_config: {
    max_results_per_query: 60,
    scroll_pause_min: 1.5,
    scroll_pause_max: 3.0,
    detail_wait_min: 2.0,
    detail_wait_max: 4.0,
    retry_attempts: 3,
    retry_delay: 3.0,
    timeout: 30000,
  },
};

type ConfigRow = { key: string; value: unknown };

// Combina las filas de app_config (Supabase) sobre los defaults. Robusto a
// claves faltantes o valores mal formados: si algo no es válido, usa el default.
export function mergeConfig(rows: ConfigRow[] | null | undefined): AppConfig {
  const byKey = new Map((rows ?? []).map((r) => [r.key, r.value]));
  const out: AppConfig = structuredClone(DEFAULT_CONFIG);

  const sq = byKey.get("search_queries");
  if (Array.isArray(sq)) out.search_queries = sq.map(String).filter((s) => s.trim() !== "");

  const ti = byKey.get("target_industries");
  if (Array.isArray(ti)) {
    const parsed = ti
      .filter((x): x is { keywords?: unknown; label?: unknown } => !!x && typeof x === "object")
      .map((x) => ({
        keywords: Array.isArray(x.keywords) ? x.keywords.map(String) : [],
        label: String(x.label ?? ""),
      }))
      .filter((x) => x.label.trim() !== "");
    if (parsed.length) out.target_industries = parsed;
  }

  const sd = byKey.get("social_domains");
  if (Array.isArray(sd)) {
    const parsed = sd.map(String).filter((s) => s.trim() !== "");
    if (parsed.length) out.social_domains = parsed;
  }

  const sw = byKey.get("scoring_weights");
  if (sw && typeof sw === "object") out.scoring_weights = { ...out.scoring_weights, ...numbersOnly(sw) };

  const pt = byKey.get("priority_thresholds");
  if (pt && typeof pt === "object") out.priority_thresholds = { ...out.priority_thresholds, ...numbersOnly(pt) };

  const sc = byKey.get("scraper_config");
  if (sc && typeof sc === "object") out.scraper_config = { ...out.scraper_config, ...numbersOnly(sc) };

  const dop = byKey.get("dropdown_options");
  if (dop && typeof dop === "object") {
    const d = dop as Record<string, unknown>;
    for (const k of ["outreach_status", "contacted", "deal_status"] as const) {
      if (Array.isArray(d[k])) out.dropdown_options[k] = (d[k] as unknown[]).map(String);
    }
  }

  return out;
}

function numbersOnly(obj: object): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
