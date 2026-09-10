"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Logo, Modal } from "@/app/dashboard/ui";

type User = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

const FIELD =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminPanel({ currentUserEmail }: { currentUserEmail: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [confirmDel, setConfirmDel] = useState<User | null>(null);

  function notify(text: string, type: "ok" | "err" = "ok") {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return notify(json.error ?? "No se pudo cargar.", "err");
    setUsers(json.users ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return notify(json.error ?? "No se pudo crear.", "err");
    setEmail("");
    setPassword("");
    notify("✓ Usuario creado.");
    load();
  }

  async function doReset(u: User, newPw: string) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, password: newPw }),
    });
    const json = await res.json();
    setResetting(null);
    if (!res.ok) return notify(json.error ?? "No se pudo resetear.", "err");
    notify(`✓ Contraseña de ${u.email} actualizada.`);
  }

  async function doDelete(u: User) {
    setConfirmDel(null);
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return notify(json.error ?? "No se pudo eliminar.", "err");
    notify(`✓ Usuario ${u.email} eliminado.`);
    load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Logo className="h-8" />
          <p className="text-sm text-slate-400">Usuarios del sistema</p>
        </div>
        <Link href="/dashboard" className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
          ← Dashboard
        </Link>
      </header>

      {/* Crear usuario */}
      <form onSubmit={createUser} className="mb-6 space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Agregar usuario</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={FIELD} type="email" placeholder="correo@ejemplo.com" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input className={FIELD} type="text" placeholder="contraseña (mín. 6)" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {busy ? "Creando…" : "Crear usuario"}
        </button>
        <p className="text-xs text-slate-500">
          El usuario queda activo de inmediato (sin verificación de correo). Comparte la contraseña por un medio seguro.
        </p>
      </form>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {loading ? (
          <p className="px-4 py-10 text-center text-slate-500">Cargando…</p>
        ) : users.length === 0 ? (
          <p className="px-4 py-10 text-center text-slate-500">No hay usuarios.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {users.map((u) => {
              const isMe = u.email?.toLowerCase() === currentUserEmail.toLowerCase();
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-100">
                      {u.email} {isMe && <span className="text-xs text-indigo-400">(tú)</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      Alta: {fmt(u.created_at)} · Último acceso: {fmt(u.last_sign_in_at)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => setResetting(u)}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800">
                      Cambiar contraseña
                    </button>
                    <button onClick={() => setConfirmDel(u)} disabled={isMe}
                      title={isMe ? "No puedes eliminarte a ti mismo" : "Eliminar"}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-40">
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Reset password modal */}
      {resetting && <ResetModal user={resetting} onClose={() => setResetting(null)} onConfirm={doReset} />}

      {/* Delete confirm modal */}
      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)} size="sm">
          <div className="p-6">
            <h3 className="mb-2 text-lg font-semibold text-white">¿Eliminar usuario?</h3>
            <p className="mb-5 text-sm text-slate-400">
              <span className="font-medium text-slate-200">{confirmDel.email}</span> perderá el acceso al dashboard.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Cancelar
              </button>
              <button onClick={() => doDelete(confirmDel)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
                Sí, eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {msg && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${msg.type === "err" ? "bg-red-600" : "bg-emerald-600"}`}>
          {msg.text}
        </div>
      )}
    </main>
  );
}

function ResetModal({ user, onClose, onConfirm }: { user: User; onClose: () => void; onConfirm: (u: User, pw: string) => void }) {
  const [pw, setPw] = useState("");
  return (
    <Modal onClose={onClose} size="sm">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-white">Cambiar contraseña</h3>
        <p className="mb-4 mt-1 text-sm text-slate-400">{user.email}</p>
        <input className={FIELD} type="text" placeholder="nueva contraseña (mín. 6)" value={pw}
          onChange={(e) => setPw(e.target.value)} autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Cancelar
          </button>
          <button onClick={() => onConfirm(user, pw)} disabled={pw.length < 6}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}
