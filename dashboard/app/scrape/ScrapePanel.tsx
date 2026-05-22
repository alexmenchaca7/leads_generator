"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ScrapeJob = {
  id: string;
  query: string;
  max_results: number | null;
  status: string; // pending | running | done | error
  requested_by: string;
  new_count: number | null;
  dup_count: number | null;
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

export default function ScrapePanel({ userEmail }: { userEmail: string }) {
  const [supabase] = useState(() => createClient());
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [worker, setWorker] = useState<{ last_seen: string | null; current_job: string | null } | null>(null);

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
    const ch = supabase
      .channel("scrape-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "scrape_jobs" }, () => loadJobs())
      .subscribe();
    const i = setInterval(loadWorker, 10000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(i);
    };
  }, [supabase, loadJobs, loadWorker]);

  const online = worker?.last_seen
    ? Date.now() - new Date(worker.last_seen).getTime() < 60000
    : false;
  const busy = !!worker?.current_job;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const q = query.trim();
    if (!q) return;
    setSubmitting(true);
    const { error } = await supabase.from("scrape_jobs").insert({
      query: q,
      max_results: maxResults,
      requested_by: userEmail,
      status: "pending",
    });
    setSubmitting(false);
    if (error) return setMsg("No se pudo crear la búsqueda: " + error.message);
    setQuery("");
    setMsg("✓ Búsqueda en cola");
    setTimeout(() => setMsg(null), 2500);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Buscar negocios</h1>
          <p className="text-sm text-slate-400">Lanza búsquedas de Google Maps al scraper</p>
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
          <span>Worker conectado{busy ? " · ocupado buscando…" : " · listo"}</span>
        ) : (
          <span>
            Worker desconectado — abre tu PC y corre{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">python -m src.worker</code>
          </span>
        )}
      </div>

      {/* Formulario */}
      <form onSubmit={submit} className="mb-6 space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">¿Qué buscar?</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ej. seguridad privada en Zapopan"
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
              return (
                <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-100">{j.query}</div>
                    <div className="text-xs text-slate-500">
                      {when(j.created_at)} · {j.requested_by || "—"}
                      {j.status === "done" && j.new_count != null && (
                        <span className="text-emerald-400"> · {j.new_count} nuevos, {j.dup_count} dup.</span>
                      )}
                      {j.status === "error" && <span className="text-red-400"> · {j.message}</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
