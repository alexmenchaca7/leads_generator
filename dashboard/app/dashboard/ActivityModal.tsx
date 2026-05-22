"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "@/types";
import { Modal } from "./ui";

type Change = { old: unknown; new: unknown };

type ActivityRow = {
  id: string;
  user_email: string;
  action: string; // update | create | delete | recover
  business_id: string | null;
  business_name: string | null;
  changes: Record<string, unknown> | null;
  undone: boolean;
  created_at: string;
};

function bulkIds(row: ActivityRow): string[] {
  const ids = row.changes?.bulk_ids;
  return Array.isArray(ids) ? (ids as string[]) : [];
}

const FIELD_LABELS: Record<string, string> = {
  outreach_status: "Estado",
  contacted: "Contactado",
  follow_up: "Seguimiento",
  notes: "Notas",
  name: "Nombre",
  phone: "Teléfono",
  website: "Web",
  address: "Domicilio",
  category: "Categoría",
  rating: "Rating",
  reviews_count: "Reseñas",
  lead_score: "Score",
  priority: "Prioridad",
  maps_url: "Maps",
  no_website: "Sin web",
  website_status: "Estado web",
};

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vacío)";
  const s = String(v);
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_VERB: Record<string, string> = {
  create: "agregó",
  delete: "vetó",
  recover: "recuperó",
  update: "editó",
};

export default function ActivityModal({
  supabase,
  onClose,
  notify,
}: {
  supabase: SupabaseClient;
  onClose: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as ActivityRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_log" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  async function recoverFromBlocklist(id: string) {
    const { data } = await supabase
      .from("blocklist")
      .select("data")
      .eq("business_id", id)
      .maybeSingle();
    const lead = (data?.data ?? null) as Record<string, unknown> | null;
    if (lead) {
      delete lead.updated_at;
      await supabase.from("leads").upsert(lead as Partial<Lead>, { onConflict: "business_id" });
      await supabase.from("blocklist").delete().eq("business_id", id);
    }
  }

  async function undo(row: ActivityRow) {
    setBusy(row.id);
    try {
      if (row.action === "update" && row.business_id && row.changes) {
        const patch: Record<string, unknown> = {};
        for (const [field, ch] of Object.entries(row.changes))
          patch[field] = (ch as Change).old;
        const { error } = await supabase
          .from("leads")
          .update(patch as Partial<Lead>)
          .eq("business_id", row.business_id);
        if (error) throw error;
      } else if (row.action === "create" && row.business_id) {
        const { error } = await supabase
          .from("leads")
          .delete()
          .eq("business_id", row.business_id);
        if (error) throw error;
      } else if (row.action === "delete") {
        // Individual o masivo (bulk_ids): recupera todos.
        const ids = bulkIds(row);
        const all = ids.length ? ids : row.business_id ? [row.business_id] : [];
        for (const id of all) await recoverFromBlocklist(id);
      } else {
        setBusy(null);
        return;
      }
      await supabase.from("activity_log").update({ undone: true }).eq("id", row.id);
      notify("✓ Cambio deshecho");
      await load();
    } catch (e) {
      notify("No se pudo deshacer: " + (e as Error).message, "error");
    }
    setBusy(null);
  }

  const canUndo = (r: ActivityRow) => {
    if (r.undone) return false;
    if (r.action === "update" || r.action === "create") return !!r.business_id;
    if (r.action === "delete") return !!r.business_id || bulkIds(r).length > 0;
    return false;
  };

  return (
    <Modal onClose={onClose} size="xl">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">Historial de cambios</h3>
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Cerrar
        </button>
      </div>

      <div className="overflow-y-auto overscroll-contain px-5 py-2">
        {loading ? (
          <p className="py-8 text-center text-slate-500">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-slate-500">Aún no hay cambios registrados.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm text-slate-200">
                    <span className="font-medium text-indigo-300">
                      {r.user_email || "sistema"}
                    </span>{" "}
                    {ACTION_VERB[r.action] ?? r.action}{" "}
                    <span className="font-medium text-slate-100">
                      {r.business_name || "—"}
                    </span>
                  </div>

                  {r.action === "update" && r.changes && (
                    <ul className="mt-1 space-y-0.5">
                      {Object.entries(r.changes).map(([field, raw]) => {
                        const ch = raw as Change;
                        return (
                          <li key={field} className="text-xs text-slate-400">
                            <span className="text-slate-500">
                              {FIELD_LABELS[field] ?? field}:
                            </span>{" "}
                            {show(ch.old)} <span className="text-slate-600">→</span>{" "}
                            <span className="text-slate-300">{show(ch.new)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="mt-1 text-[11px] text-slate-600">
                    {timeAgo(r.created_at)}
                    {r.undone && (
                      <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
                        deshecho
                      </span>
                    )}
                  </div>
                </div>

                {canUndo(r) && (
                  <button
                    onClick={() => undo(r)}
                    disabled={busy === r.id}
                    className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy === r.id ? "…" : "Deshacer"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
