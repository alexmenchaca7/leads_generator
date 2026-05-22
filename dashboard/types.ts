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
  no_website: boolean;
  lead_score: number;
  priority: string;
  website_status: string | null;
  first_seen: string | null;
  last_seen: string | null;
  outreach_status: string;
  contacted: string;
  follow_up: string | null;
  notes: string | null;
  updated_at: string;
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
