export type Lead = {
  business_id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
  is_target: boolean;
  lead_score: number;
  priority: string;
  web_status: string | null;
  industry: string | null;
  first_seen: string | null;
  last_seen: string | null;
  outreach_status: string;
  contacted: string;
  follow_up: string | null;
  notes: string | null;
  // Tablero (kanban): posición dentro de su columna y etiquetas de color.
  // board_position NULL = lead nuevo que nadie ha ordenado a mano todavía.
  board_position: number | null;
  board_labels: string[] | null;
  updated_at: string;
};

// ── Tablero ───────────────────────────────────────────────────────────────────
// Una nota de la bitácora de la tarjeta (tabla lead_comments). A diferencia de
// Lead.notes —un solo texto que se sobreescribe— aquí cada nota es un renglón
// nuevo con autor y fecha, así queda la conversación completa.
export type LeadComment = {
  id: string;
  business_id: string;
  user_email: string;
  body: string;
  created_at: string;
};

// Imagen o archivo adjunto a la tarjeta (tabla lead_attachments + Storage).
export type LeadAttachment = {
  id: string;
  business_id: string;
  user_email: string;
  path: string;
  url: string;
  name: string;
  mime: string;
  size: number | null;
  created_at: string;
};

export const BOARD_BUCKET = "lead-files";

// Etiquetas de color de la tarjeta. La clave es lo que se guarda en
// leads.board_labels; el resto es solo presentación.
export const BOARD_LABELS: { key: string; label: string; dot: string; chip: string }[] = [
  { key: "urgente",   label: "Urgente",        dot: "bg-red-500",     chip: "bg-red-500/15 text-red-300 ring-red-500/30" },
  { key: "propuesta", label: "Propuesta lista", dot: "bg-violet-500",  chip: "bg-violet-500/15 text-violet-300 ring-violet-500/30" },
  { key: "maqueta",   label: "Maqueta hecha",   dot: "bg-sky-500",     chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30" },
  { key: "recontacto", label: "Recontactar",    dot: "bg-amber-500",   chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  { key: "ganado",    label: "Cerrado",         dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
];

export const BOARD_LABEL_MAP: Record<string, (typeof BOARD_LABELS)[number]> =
  Object.fromEntries(BOARD_LABELS.map((l) => [l.key, l]));

// ── Presencia web ─────────────────────────────────────────────────────────────
// La señal central del negocio: la agencia vende sitios web, así que el mejor
// prospecto es el que no tiene sitio propio.
export const WEB_SIN = "sin_web";
export const WEB_REDES = "solo_redes";
export const WEB_PROPIO = "con_web";

export const WEB_LABELS: Record<string, string> = {
  [WEB_SIN]: "Sin web",
  [WEB_REDES]: "Solo redes",
  [WEB_PROPIO]: "Con web",
};

// Colores por presencia web: verde = mejor prospecto, ámbar = buen prospecto,
// gris = ya tiene sitio propio.
export const WEB_STYLES: Record<string, string> = {
  [WEB_SIN]: "bg-emerald-500/15 text-emerald-300",
  [WEB_REDES]: "bg-amber-500/15 text-amber-300",
  [WEB_PROPIO]: "bg-slate-700/50 text-slate-400",
};

// ── Configuración del sistema (tabla app_config en Supabase) ──────────────────
// Refleja las secciones de config.py. Los valores por defecto viven en
// lib/configDefaults.ts (espejo de config.py) y app_config los sobreescribe.
export type TargetIndustry = { keywords: string[]; label: string };

export type ScoringWeights = {
  no_website: number;
  only_social: number;
  target_industry: number;
  reviews_high: number;
  reviews_medium: number;
  reviews_low: number;
  rating_excellent: number;
  rating_good: number;
  has_phone: number;
};

export type PriorityThresholds = { high: number; medium: number };

export type DropdownOptions = {
  outreach_status: string[];
  contacted: string[];
  deal_status: string[];
};

export type ScraperConfig = {
  max_results_per_query: number;
  scroll_pause_min: number;
  scroll_pause_max: number;
  detail_wait_min: number;
  detail_wait_max: number;
  retry_attempts: number;
  retry_delay: number;
  timeout: number;
};

export type AppConfig = {
  search_queries: string[];
  target_industries: TargetIndustry[];
  social_domains: string[];
  scoring_weights: ScoringWeights;
  priority_thresholds: PriorityThresholds;
  dropdown_options: DropdownOptions;
  scraper_config: ScraperConfig;
};

// Opciones de los menús desplegables (deben coincidir con config.py del scraper)
export const OUTREACH_OPTIONS = [
  "pendiente",
  "contactado",
  "no contestó",
  "interesado",
  "no interesado",
  "cliente",
];

export const CONTACTED_OPTIONS = ["sí", "no"];
