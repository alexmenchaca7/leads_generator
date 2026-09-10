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
  updated_at: string;
};

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
