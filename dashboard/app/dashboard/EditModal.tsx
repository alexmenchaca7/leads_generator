"use client";

import { useState } from "react";
import { type Lead, OUTREACH_OPTIONS, CONTACTED_OPTIONS } from "@/types";
import { DateField, Modal } from "./ui";

const FIELD =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLead(): Lead {
  return {
    business_id: `manual-${crypto.randomUUID()}`,
    name: "",
    category: "",
    address: "",
    phone: "",
    website: "",
    rating: null,
    reviews_count: null,
    lat: null,
    lng: null,
    maps_url: "",
    no_website: true,
    lead_score: 0,
    priority: "low",
    website_status: "no_website",
    first_seen: todayISO(),
    last_seen: todayISO(),
    outreach_status: "pendiente",
    contacted: "no",
    follow_up: null,
    notes: "",
    updated_at: todayISO(),
  };
}

export default function EditModal({
  mode,
  lead,
  onClose,
  onSave,
}: {
  mode: "edit" | "create";
  lead: Lead | null;
  onClose: () => void;
  onSave: (values: Lead, mode: "edit" | "create") => void;
}) {
  const [form, setForm] = useState<Lead>(lead ?? emptyLead());

  function set<K extends keyof Lead>(key: K, value: Lead[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function num(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  function submit() {
    if (!form.name.trim()) {
      alert("El nombre es obligatorio.");
      return;
    }
    const website = (form.website ?? "").trim();
    const no_website = website === "";
    onSave(
      {
        ...form,
        website,
        no_website,
        website_status: no_website ? "no_website" : "has_website",
      },
      mode
    );
  }

  return (
    <Modal onClose={onClose} size="xl">
      <div className="shrink-0 border-b border-slate-800 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">
          {mode === "create" ? "Nuevo lead" : "Editar lead"}
        </h3>
      </div>

      <div className="overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre *" full>
            <input className={FIELD} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>

          <Field label="Categoría">
            <input className={FIELD} value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <input className={FIELD} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </Field>

          <Field label="Dirección" full>
            <input className={FIELD} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </Field>

          <Field label="Sitio web (vacío = sin web)" full>
            <input className={FIELD} value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
          </Field>

          <Field label="Rating">
            <input className={FIELD} type="number" step="0.1" value={form.rating ?? ""} onChange={(e) => set("rating", num(e.target.value))} />
          </Field>
          <Field label="Reseñas">
            <input className={FIELD} type="number" value={form.reviews_count ?? ""} onChange={(e) => set("reviews_count", num(e.target.value))} />
          </Field>

          <Field label="Score">
            <input className={FIELD} type="number" value={form.lead_score ?? 0} onChange={(e) => set("lead_score", num(e.target.value) ?? 0)} />
          </Field>
          <Field label="Prioridad">
            <select className={FIELD} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </Field>

          <Field label="Estado">
            <select className={FIELD} value={form.outreach_status} onChange={(e) => set("outreach_status", e.target.value)}>
              {OUTREACH_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Contactado">
            <select className={FIELD} value={form.contacted} onChange={(e) => set("contacted", e.target.value)}>
              {CONTACTED_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>

          <Field label="Seguimiento">
            <DateField value={form.follow_up} onChange={(v) => set("follow_up", v)} className="w-full" />
          </Field>
          <Field label="Link de Maps">
            <input className={FIELD} value={form.maps_url ?? ""} onChange={(e) => set("maps_url", e.target.value)} />
          </Field>

          <Field label="Notas" full>
            <textarea className={FIELD + " resize-y"} rows={4} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-slate-800 px-5 py-4">
        <button onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
          Cancelar
        </button>
        <button onClick={submit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          {mode === "create" ? "Agregar" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`space-y-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}
