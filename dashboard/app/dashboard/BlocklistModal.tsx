"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "@/types";

type BlockRow = {
  business_id: string;
  name: string | null;
  data: Lead | null;
  created_at: string;
};

export default function BlocklistModal({
  supabase,
  onClose,
  onRecovered,
  notify,
}: {
  supabase: SupabaseClient;
  onClose: () => void;
  onRecovered: (lead: Lead) => void;
  notify: (msg: string, type?: "success" | "error") => void;
}) {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("blocklist")
        .select("business_id, name, data, created_at")
        .order("created_at", { ascending: false });
      if (error) notify("No se pudo cargar la lista: " + error.message, "error");
      setRows((data as BlockRow[]) ?? []);
      setLoading(false);
    })();
  }, [supabase, notify]);

  async function recover(row: BlockRow) {
    setBusy(row.business_id);
    if (row.data) {
      const lead: Record<string, unknown> = { ...row.data };
      delete lead.updated_at;
      const { error } = await supabase
        .from("leads")
        .upsert(lead, { onConflict: "business_id" });
      if (error) {
        notify("No se pudo recuperar: " + error.message, "error");
        setBusy(null);
        return;
      }
    }
    await supabase.from("blocklist").delete().eq("business_id", row.business_id);
    setRows((prev) => prev.filter((r) => r.business_id !== row.business_id));
    if (row.data) onRecovered(row.data);
    notify(`✓ Recuperado: ${row.name || row.business_id}`);
    setBusy(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Negocios vetados {rows.length > 0 && `(${rows.length})`}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-slate-500">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            No hay negocios vetados.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {rows.map((r) => (
              <li
                key={r.business_id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-100">
                    {r.name || r.business_id}
                  </div>
                  <div className="text-xs text-slate-500">
                    Vetado el {new Date(r.created_at).toLocaleDateString("es-MX")}
                    {!r.data && " · sin datos guardados (reaparecerá al scrapear)"}
                  </div>
                </div>
                <button
                  onClick={() => recover(r)}
                  disabled={busy === r.business_id}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {busy === r.business_id ? "…" : "Recuperar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
