"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type Lead,
  OUTREACH_OPTIONS,
  CONTACTED_OPTIONS,
} from "@/types";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

function rowClass(lead: Lead): string {
  if (lead.no_website && lead.priority === "high") return "bg-amber-50";
  if (lead.no_website) return "bg-green-50/60";
  return "";
}

export default function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [supabase] = useState(() => createClient());
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [onlyNoWeb, setOnlyNoWeb] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // ── Realtime: refleja inserts del scraper y ediciones de tu socio en vivo ──
  useEffect(() => {
    const channel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          setLeads((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter(
                (l) => l.business_id !== (payload.old as Lead).business_id
              );
            }
            const row = payload.new as Lead;
            const exists = prev.some((l) => l.business_id === row.business_id);
            const next = exists
              ? prev.map((l) => (l.business_id === row.business_id ? row : l))
              : [...prev, row];
            return next.sort((a, b) => b.lead_score - a.lead_score);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // ── Edición ────────────────────────────────────────────────────────────────
  async function updateLead(id: string, patch: Partial<Lead>) {
    setSaving(id);
    setLeads((prev) =>
      prev.map((l) => (l.business_id === id ? { ...l, ...patch } : l))
    );
    const { error } = await supabase.from("leads").update(patch).eq("business_id", id);
    setSaving(null);
    if (error) alert("No se pudo guardar: " + error.message);
  }

  // ── Filtros ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (priorityFilter !== "all" && l.priority !== priorityFilter) return false;
      if (onlyNoWeb && !l.no_website) return false;
      if (q) {
        const hay = `${l.name} ${l.category ?? ""} ${l.address ?? ""} ${l.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, priorityFilter, onlyNoWeb]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    return {
      total: leads.length,
      sinWeb: leads.filter((l) => l.no_website).length,
      alta: leads.filter((l) => l.priority === "high").length,
      contactados: leads.filter((l) => l.contacted === "sí").length,
    };
  }, [leads]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total leads" value={stats.total} />
        <Stat label="Sin sitio web" value={stats.sinWeb} accent="text-green-600" />
        <Stat label="Prioridad alta" value={stats.alta} accent="text-red-600" />
        <Stat label="Contactados" value={stats.contactados} accent="text-blue-600" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono, dirección…"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Todas las prioridades</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyNoWeb}
            onChange={(e) => setOnlyNoWeb(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Solo sin web
        </label>
        <span className="ml-auto text-sm text-slate-500">
          {filtered.length} de {leads.length}
          {saving && <span className="ml-2 text-blue-500">guardando…</span>}
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Negocio</Th>
              <Th>Teléfono</Th>
              <Th>Web</Th>
              <Th>Rating</Th>
              <Th>Score</Th>
              <Th>Prioridad</Th>
              <Th>Estado</Th>
              <Th>Contactado</Th>
              <Th>Seguimiento</Th>
              <Th>Notas</Th>
              <Th>Maps</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((l) => (
              <tr key={l.business_id} className={rowClass(l)}>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{l.name}</div>
                  <div className="text-xs text-slate-400">{l.category}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{l.phone || "—"}</td>
                <td className="px-3 py-2">
                  {l.no_website ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Sin web
                    </span>
                  ) : (
                    <a
                      href={l.website ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      sitio
                    </a>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {l.rating ? `${l.rating}★` : "—"}
                  <span className="text-xs text-slate-400">
                    {l.reviews_count ? ` (${l.reviews_count})` : ""}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold">{l.lead_score}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      PRIORITY_STYLES[l.priority] ?? PRIORITY_STYLES.low
                    }`}
                  >
                    {l.priority}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={l.outreach_status ?? "pendiente"}
                    onChange={(e) =>
                      updateLead(l.business_id, { outreach_status: e.target.value })
                    }
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    {OUTREACH_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={l.contacted ?? "no"}
                    onChange={(e) =>
                      updateLead(l.business_id, { contacted: e.target.value })
                    }
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    {CONTACTED_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={l.follow_up ?? ""}
                    onChange={(e) =>
                      updateLead(l.business_id, {
                        follow_up: e.target.value || null,
                      })
                    }
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    defaultValue={l.notes ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (l.notes ?? ""))
                        updateLead(l.business_id, { notes: e.target.value });
                    }}
                    placeholder="…"
                    className="w-40 rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  {l.maps_url ? (
                    <a
                      href={l.maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      ver
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-slate-400">
                  No hay leads que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-slate-900",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold">{children}</th>;
}
