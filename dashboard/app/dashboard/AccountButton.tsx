"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "./ui";

const FIELD =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500";

export default function AccountButton({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw1.length < 6) return setMsg({ text: "La contraseña debe tener al menos 6 caracteres.", type: "err" });
    if (pw1 !== pw2) return setMsg({ text: "Las contraseñas no coinciden.", type: "err" });

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (error) return setMsg({ text: "No se pudo cambiar: " + error.message, type: "err" });
    setPw1("");
    setPw2("");
    setMsg({ text: "✓ Contraseña actualizada.", type: "ok" });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
      >
        Mi cuenta
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} size="sm">
          <div className="p-5">
            <h3 className="text-lg font-semibold text-white">Mi cuenta</h3>
            <p className="mb-4 mt-1 text-sm text-slate-400">{userEmail}</p>

            <form onSubmit={changePassword} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Nueva contraseña</label>
                <input type="password" className={FIELD} value={pw1} autoComplete="new-password"
                  onChange={(e) => setPw1(e.target.value)} placeholder="mínimo 6 caracteres" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Repetir contraseña</label>
                <input type="password" className={FIELD} value={pw2} autoComplete="new-password"
                  onChange={(e) => setPw2(e.target.value)} />
              </div>

              {msg && (
                <p className={`text-sm ${msg.type === "err" ? "text-red-400" : "text-emerald-400"}`}>{msg.text}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                  Cerrar
                </button>
                <button type="submit" disabled={busy}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
                  {busy ? "Guardando…" : "Cambiar contraseña"}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
