"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AppConfig, ScoringWeights, PriorityThresholds, ScraperConfig } from "@/types";
import { DEFAULT_CONFIG } from "@/lib/configDefaults";
import { Logo } from "@/app/dashboard/ui";
import { ScoreInfo } from "@/app/dashboard/ScoreInfo";

const CARD = "rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5";
const INPUT =
  "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500";
const NUM = "w-28 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-indigo-500";

const WEIGHT_FIELDS: { key: keyof ScoringWeights; label: string; help: string }[] = [
  { key: "no_website", label: "No tiene nada en internet", help: "El prospecto ideal: no aparece ningún sitio en su ficha." },
  { key: "only_social", label: "Solo redes o página gratis", help: "Su «sitio» es un Facebook, Instagram o una página gratis. Venta fácil." },
  { key: "target_industry", label: "Giro objetivo", help: "Giros donde un sitio web se vende bien (citas, menú, catálogo)." },
  { key: "reviews_high", label: "100 reseñas o más", help: "Negocio consolidado: tiene clientes y presupuesto." },
  { key: "reviews_medium", label: "50 a 99 reseñas", help: "Negocio mediano." },
  { key: "reviews_low", label: "20 a 49 reseñas", help: "Negocio chico pero establecido." },
  { key: "rating_excellent", label: "Rating 4.5 o más", help: "Negocio bien valorado: vale la pena invertirle." },
  { key: "rating_good", label: "Rating 4.0 a 4.4", help: "Negocio con buena reputación." },
  { key: "has_phone", label: "Tiene teléfono", help: "Que se pueda contactar para ofrecerle el servicio." },
];

const SCRAPER_FIELDS: { key: keyof ScraperConfig; label: string; step?: string }[] = [
  { key: "max_results_per_query", label: "Máx. resultados por búsqueda" },
  { key: "scroll_pause_min", label: "Pausa mínima al desplazar (seg)", step: "0.1" },
  { key: "scroll_pause_max", label: "Pausa máxima al desplazar (seg)", step: "0.1" },
  { key: "detail_wait_min", label: "Espera mínima por negocio (seg)", step: "0.1" },
  { key: "detail_wait_max", label: "Espera máxima por negocio (seg)", step: "0.1" },
  { key: "retry_attempts", label: "Reintentos por negocio" },
  { key: "retry_delay", label: "Espera entre reintentos (seg)", step: "0.1" },
  { key: "timeout", label: "Tiempo máx. de carga (ms)", step: "1000" },
];

export default function ConfigPanel({
  userEmail,
  initialConfig,
}: {
  userEmail: string;
  initialConfig: AppConfig;
}) {
  const [supabase] = useState(() => createClient());
  const [cfg, setCfg] = useState<AppConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function notify(text: string, type: "ok" | "err" = "ok") {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  async function save() {
    setSaving(true);
    const now = new Date().toISOString();
    const payload = [
      { key: "search_queries", value: cfg.search_queries, updated_at: now },
      { key: "target_industries", value: cfg.target_industries, updated_at: now },
      { key: "social_domains", value: cfg.social_domains, updated_at: now },
      { key: "scoring_weights", value: cfg.scoring_weights, updated_at: now },
      { key: "priority_thresholds", value: cfg.priority_thresholds, updated_at: now },
      { key: "dropdown_options", value: cfg.dropdown_options, updated_at: now },
      { key: "scraper_config", value: cfg.scraper_config, updated_at: now },
    ];
    const { error } = await supabase.from("app_config").upsert(payload, { onConflict: "key" });
    setSaving(false);
    if (error) return notify("No se pudo guardar: " + error.message, "err");
    notify("✓ Configuración guardada. Aplica en la próxima búsqueda.");
  }

  async function rescore() {
    setRescoring(true);
    const { error } = await supabase.from("scrape_jobs").insert({
      query: "__rescore__",
      requested_by: userEmail,
    });
    setRescoring(false);
    if (error) return notify("No se pudo encolar el recálculo: " + error.message, "err");
    notify("✓ Recálculo encolado. El motor de búsquedas lo procesará (debe estar encendido).");
  }

  function resetDefaults() {
    setCfg(structuredClone(DEFAULT_CONFIG));
    notify("Valores por defecto cargados. Recuerda Guardar para aplicarlos.");
  }

  // Setters tipados por sección
  const setNum =
    <T extends ScoringWeights | PriorityThresholds | ScraperConfig>(section: keyof AppConfig) =>
    (key: string, v: number) =>
      setCfg((c) => ({ ...c, [section]: { ...(c[section] as T), [key]: v } }));

  const setWeight = setNum<ScoringWeights>("scoring_weights");
  const setThreshold = setNum<PriorityThresholds>("priority_thresholds");
  const setScraper = setNum<ScraperConfig>("scraper_config");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Logo className="h-8" />
          <p className="text-sm text-slate-400">Configuración del sistema</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
            ← Volver
          </Link>
          <button onClick={save} disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </header>

      <p className="mb-5 rounded-lg bg-slate-800/60 px-4 py-3 text-sm text-slate-300">
        Todo lo que cambies aquí controla cómo el sistema busca y prioriza negocios. Los cambios
        se guardan en la nube y se aplican <b>en la siguiente búsqueda</b>. Para que los leads que
        ya tienes se reordenen con la nueva configuración, usa <b>Recalcular leads</b>.
      </p>

      <div className="space-y-6">
        {/* 1. Búsquedas */}
        <Section title="Búsquedas" desc="Cada renglón es una búsqueda en Google Maps. Combina giro + ciudad, ej. «dentista en Zapopan».">
          <StringListEditor
            items={cfg.search_queries}
            placeholder="dentista en Guadalajara"
            onChange={(v) => setCfg((c) => ({ ...c, search_queries: v }))}
            addLabel="+ Agregar búsqueda"
          />
        </Section>

        {/* 2. Presencia web (dominios que NO cuentan como sitio propio) */}
        <Section
          title="¿Qué NO cuenta como sitio web propio?"
          desc="Muchos negocios ponen su Facebook o una página gratis en el campo «sitio web» de Google Maps. Eso no es un sitio propio: siguen siendo prospecto (y de los más fáciles de cerrar). Si el link contiene alguna de estas cadenas, el negocio se marca como «Solo redes» en vez de «Con web»."
        >
          <StringListEditor
            items={cfg.social_domains}
            placeholder="facebook.com"
            onChange={(v) => setCfg((c) => ({ ...c, social_domains: v }))}
            addLabel="+ Agregar dominio"
          />
        </Section>

        {/* 3. Industrias objetivo */}
        <Section
          title="Giros objetivo"
          desc="Etiqueta el negocio por giro y le suma puntos si cae en uno de estos (son los giros donde un sitio web se vende mejor). No decide si es prospecto: eso lo decide la presencia web. Las palabras van separadas por coma; usa raíces (ej. «dentist» cubre dentista/dentistas)."
        >
          <IndustriesEditor
            items={cfg.target_industries}
            onChange={(v) => setCfg((c) => ({ ...c, target_industries: v }))}
          />
        </Section>

        {/* 4. Puntuación */}
        <Section title="Puntuación (score)" desc="Puntos que suma cada característica. Entre más alto el peso, más sube en el ranking ese factor.">
          <div className="grid gap-3 sm:grid-cols-2">
            {WEIGHT_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm text-slate-200">{f.label}</span>
                  <span className="block text-xs text-slate-500">{f.help}</span>
                </span>
                <input type="number" className={NUM} value={cfg.scoring_weights[f.key]}
                  onChange={(e) => setWeight(f.key, toNum(e.target.value))} />
              </label>
            ))}
          </div>

          <details className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-indigo-300">
              Ver cómo queda la explicación del score
            </summary>
            <div className="border-t border-slate-800 p-3">
              <ScoreInfo weights={cfg.scoring_weights} thresholds={cfg.priority_thresholds} />
            </div>
          </details>
        </Section>

        {/* 5. Prioridad */}
        <Section title="Prioridad" desc="A partir de qué score un lead se marca como prioridad alta o media (lo demás es baja).">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">alta</span>
              <span className="text-sm text-slate-400">score ≥</span>
              <input type="number" className={NUM} value={cfg.priority_thresholds.high}
                onChange={(e) => setThreshold("high", toNum(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">media</span>
              <span className="text-sm text-slate-400">score ≥</span>
              <input type="number" className={NUM} value={cfg.priority_thresholds.medium}
                onChange={(e) => setThreshold("medium", toNum(e.target.value))} />
            </label>
          </div>
        </Section>

        {/* 6. Menús desplegables */}
        <Section title="Menús (listas desplegables)" desc="Opciones que aparecen en los menús del tablero al trabajar cada lead.">
          <div className="grid gap-4 sm:grid-cols-3">
            <SubList label="Estado de contacto"
              items={cfg.dropdown_options.outreach_status}
              onChange={(v) => setCfg((c) => ({ ...c, dropdown_options: { ...c.dropdown_options, outreach_status: v } }))} />
            <SubList label="¿Contactado?"
              items={cfg.dropdown_options.contacted}
              onChange={(v) => setCfg((c) => ({ ...c, dropdown_options: { ...c.dropdown_options, contacted: v } }))} />
            <SubList label="Estado del trato"
              items={cfg.dropdown_options.deal_status}
              onChange={(v) => setCfg((c) => ({ ...c, dropdown_options: { ...c.dropdown_options, deal_status: v } }))} />
          </div>
        </Section>

        {/* 7. Avanzado */}
        <Section title="Avanzado · Motor de búsquedas" desc="Parámetros técnicos de cómo navega Google Maps. Cámbialos solo si sabes lo que haces; valores muy bajos pueden provocar bloqueos o resultados incompletos.">
          <button onClick={() => setShowAdvanced((v) => !v)}
            className="mb-3 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            {showAdvanced ? "Ocultar parámetros" : "Mostrar parámetros"}
          </button>
          {showAdvanced && (
            <div className="grid gap-3 sm:grid-cols-2">
              {SCRAPER_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2">
                  <span className="text-sm text-slate-200">{f.label}</span>
                  <input type="number" step={f.step} className={NUM} value={cfg.scraper_config[f.key]}
                    onChange={(e) => setScraper(f.key, toNum(e.target.value))} />
                </label>
              ))}
            </div>
          )}
        </Section>

        {/* Acciones finales */}
        <div className={`${CARD} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <div className="text-sm font-semibold text-slate-100">Recalcular leads existentes</div>
            <div className="text-xs text-slate-500">
              Re-puntúa y re-clasifica todos los leads guardados con la configuración actual.
              Requiere el motor de búsquedas encendido en tu PC.
            </div>
          </div>
          <button onClick={rescore} disabled={rescoring}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
            {rescoring ? "Encolando…" : "Recalcular leads"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={resetDefaults} className="text-sm text-slate-500 underline hover:text-slate-300">
            Restaurar valores por defecto
          </button>
          <button onClick={save} disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${msg.type === "err" ? "bg-red-600" : "bg-emerald-600"}`}>
          {msg.text}
        </div>
      )}
    </main>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────────
function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mb-3 mt-1 text-xs text-slate-400">{desc}</p>
      {children}
    </section>
  );
}

function StringListEditor({
  items, onChange, placeholder, addLabel,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input className={INPUT} value={item} placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 rounded-md border border-slate-700 px-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400" title="Quitar">
            ✕
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ""])}
        className="rounded-lg border border-dashed border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:border-indigo-500 hover:text-indigo-300">
        {addLabel ?? "+ Agregar"}
      </button>
    </div>
  );
}

function SubList({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-300">{label}</div>
      <StringListEditor items={items} onChange={onChange} addLabel="+ Agregar opción" />
    </div>
  );
}

function IndustriesEditor({
  items, onChange,
}: {
  items: { keywords: string[]; label: string }[];
  onChange: (v: { keywords: string[]; label: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="hidden gap-2 px-1 text-xs text-slate-500 sm:flex">
        <span className="w-1/3">Etiqueta del segmento</span>
        <span className="flex-1">Palabras clave (separadas por coma)</span>
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-800/40 p-2 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
          <input className={`${INPUT} sm:w-1/3`} value={it.label} placeholder="Dental"
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <div className="flex flex-1 gap-2">
            <input className={INPUT} value={it.keywords.join(", ")} placeholder="dentist, dental, ortodon"
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, keywords: splitKeywords(e.target.value) } : x)))} />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="shrink-0 rounded-md border border-slate-700 px-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400" title="Quitar">
              ✕
            </button>
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...items, { label: "", keywords: [] }])}
        className="rounded-lg border border-dashed border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:border-indigo-500 hover:text-indigo-300">
        + Agregar giro
      </button>
    </div>
  );
}

function splitKeywords(s: string): string[] {
  return s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function toNum(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
