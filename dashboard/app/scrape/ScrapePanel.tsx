"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/app/dashboard/ui";
import type { AppConfig } from "@/types";
import WorkerGuide from "./WorkerGuide";

type ScrapeJob = {
  id: string;
  query: string;
  max_results: number | null;
  status: string; // pending | running | done | error
  requested_by: string;
  new_count: number | null;
  dup_count: number | null;
  new_names: string[] | null;
  skipped_names: string[] | null;
  message: string;
  created_at: string;
  finished_at: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "En cola", cls: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30" },
  running: { label: "Buscando…", cls: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30" },
  done: { label: "Listo", cls: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" },
  error: { label: "Error", cls: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30" },
};

function when(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScrapePanel({ userEmail, config }: { userEmail: string; config: AppConfig }) {
  const [supabase] = useState(() => createClient());
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(config.scraper_config.max_results_per_query);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [worker, setWorker] = useState<{ last_seen: string | null; current_job: string | null } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    const { data } = await supabase
      .from("scrape_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    setJobs((data as ScrapeJob[]) ?? []);
  }, [supabase]);

  const loadWorker = useCallback(async () => {
    const { data } = await supabase
      .from("worker_status")
      .select("last_seen, current_job")
      .eq("id", 1)
      .maybeSingle();
    setWorker(data);
  }, [supabase]);

  useEffect(() => {
    loadJobs();
    loadWorker();
    // Realtime (si esta activado en Supabase) + sondeo de respaldo: asi el estado
    // de las busquedas (en cola -> buscando -> listo) se actualiza solo aunque
    // Realtime no este configurado para estas tablas.
    const ch = supabase
      .channel("scrape-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "scrape_jobs" }, () => loadJobs())
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_status" }, () => loadWorker())
      .subscribe();
    const iJobs = setInterval(loadJobs, 4000);
    const iWorker = setInterval(loadWorker, 8000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(iJobs);
      clearInterval(iWorker);
    };
  }, [supabase, loadJobs, loadWorker]);

  const online = worker?.last_seen
    ? Date.now() - new Date(worker.last_seen).getTime() < 60000
    : false;
  const busy = !!worker?.current_job;

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2800);
  }

  async function enqueue(queries: string[]) {
    const rows = queries
      .map((q) => q.trim())
      .filter(Boolean)
      .map((q) => ({ query: q, max_results: maxResults, requested_by: userEmail, status: "pending" }));
    if (rows.length === 0) return;
    setSubmitting(true);
    const { error } = await supabase.from("scrape_jobs").insert(rows);
    setSubmitting(false);
    if (error) return setMsg("No se pudo crear la búsqueda: " + error.message);
    flash(rows.length === 1 ? "✓ Búsqueda en cola" : `✓ ${rows.length} búsquedas en cola`);
    // Refresca de inmediato para que aparezca "en cola" sin esperar.
    loadJobs();
    loadWorker();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!query.trim()) return;
    await enqueue([query]);
    setQuery("");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Logo className="h-9" />
          <h1 className="text-lg font-semibold text-white">Buscar negocios</h1>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Dashboard
        </Link>
      </header>

      {/* Estado del worker */}
      <div
        className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          online
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-red-500/30 bg-red-500/10 text-red-300"
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`} />
        {online ? (
          <span>Motor de búsquedas conectado{busy ? " · ocupado buscando…" : " · listo"}</span>
        ) : (
          <span>
            Motor de búsquedas <b>apagado</b>. Enciende la PC designada y abre el acceso
            directo <b>«Iniciar búsquedas»</b>; en unos segundos esta barra se pondrá verde.
            (Ver guía abajo.)
          </span>
        )}
      </div>

      {/* Guía dentro del dashboard */}
      <WorkerGuide online={online} />

      {/* Búsquedas configuradas */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Búsquedas configuradas</h2>
          <Link href="/config" className="text-xs text-indigo-400 hover:text-indigo-300">Editar lista ⚙</Link>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Lanza las búsquedas que definiste en Configurar. Cada una usa el máx. de resultados de abajo.
        </p>

        {config.search_queries.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay búsquedas configuradas.{" "}
            <Link href="/config" className="text-indigo-400 hover:text-indigo-300">Agrégalas en Configurar</Link>.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={() => enqueue(config.search_queries)}
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                ⚡ Buscar todas ({config.search_queries.length})
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.search_queries.map((q) => (
                <button
                  key={q}
                  onClick={() => enqueue([q])}
                  disabled={submitting}
                  title="Lanzar esta búsqueda"
                  className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:border-indigo-500 hover:text-white disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Formulario */}
      <form onSubmit={submit} className="mb-6 space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">Búsqueda puntual</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ej. dentista en Zapopan"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Máx. resultados</label>
            <input
              type="number"
              min={1}
              max={300}
              value={maxResults}
              onChange={(e) => setMaxResults(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !query.trim()}
            className="flex-1 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? "Enviando…" : "Buscar"}
          </button>
        </div>
        {msg && <p className="text-sm text-slate-400">{msg}</p>}
        <p className="text-xs text-slate-500">
          La búsqueda se ejecuta en tu PC (sin abrir navegador) y los nuevos negocios
          aparecen solos en el Dashboard. Se omiten los ya guardados y los vetados.
        </p>
      </form>

      {/* Historial de búsquedas */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Búsquedas recientes
      </h2>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {jobs.length === 0 ? (
          <p className="px-4 py-10 text-center text-slate-500">Aún no hay búsquedas.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {jobs.map((j) => {
              const s = STATUS[j.status] ?? STATUS.pending;
              const newNames = j.new_names ?? [];
              const skippedNames = j.skipped_names ?? [];
              const hasDetail = j.status === "done" && (newNames.length > 0 || skippedNames.length > 0);
              const isOpen = expanded === j.id;
              return (
                <li key={j.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-100">{j.query}</div>
                      <div className="text-xs text-slate-500">
                        {when(j.created_at)} · {j.requested_by || "—"}
                        {j.status === "done" && j.new_count != null && (
                          <span className="text-emerald-400"> · {j.new_count} nuevos, {skippedNames.length} omitidos</span>
                        )}
                        {j.status === "error" && <span className="text-red-400"> · {j.message}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {hasDetail && (
                        <button
                          onClick={() => setExpanded(isOpen ? null : j.id)}
                          className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          {isOpen ? "Ocultar" : "Ver detalle"}
                        </button>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                        {s.label}
                      </span>
                    </div>
                  </div>

                  {isOpen && hasDetail && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <NameList
                        title={`Nuevos (${newNames.length})`}
                        names={newNames}
                        cls="text-emerald-300"
                      />
                      <NameList
                        title={`Omitidos (${skippedNames.length})`}
                        names={skippedNames}
                        cls="text-slate-400"
                        hint="Ya estaban en el sistema o vetados"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function NameList({
  title,
  names,
  cls,
  hint,
}: {
  title: string;
  names: string[];
  cls: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${cls}`}>{title}</div>
      {hint && <div className="mb-2 text-[11px] text-slate-600">{hint}</div>}
      {names.length === 0 ? (
        <div className="text-xs text-slate-600">—</div>
      ) : (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto overscroll-contain text-xs text-slate-300">
          {names.map((n, i) => (
            <li key={i} className="truncate">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
