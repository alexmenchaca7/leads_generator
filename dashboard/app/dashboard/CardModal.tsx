"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Lead,
  type LeadAttachment,
  type LeadComment,
  BOARD_BUCKET,
  BOARD_LABELS,
  WEB_LABELS,
  WEB_STYLES,
  WEB_PROPIO,
} from "@/types";
import { cleanPhone, siteHost } from "@/lib/clean";
import { DateField, LinkButton, Modal, PhoneLink, WhatsAppLink } from "./ui";

// Tope por archivo. Storage aguanta más, pero una tarjeta de prospección no
// necesita subir un video: si se pasa, avisamos en vez de fallar en silencio.
const MAX_MB = 8;
const ACCEPT = "image/*,application/pdf";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Nombre seguro para la ruta del bucket (sin acentos ni espacios).
function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .slice(-60);
}

export default function CardModal({
  lead,
  supabase,
  userEmail,
  statuses,
  files,
  onClose,
  onUpdate,
  onEdit,
  onDelete,
  onChanged,
  notify,
}: {
  lead: Lead;
  supabase: SupabaseClient;
  userEmail: string;
  statuses: string[];
  files: LeadAttachment[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void | Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}) {
  const [comments, setComments] = useState<LeadComment[]>([]);
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [dropping, setDropping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const phone = cleanPhone(lead.phone);
  const web = lead.web_status ?? WEB_PROPIO;
  const labels = lead.board_labels ?? [];

  // Registra en el historial compartido (mismo log que usa el resto del tablero).
  const log = useCallback(
    async (action: string, changes: Record<string, unknown> | null) => {
      await supabase.from("activity_log").insert({
        user_email: userEmail,
        action,
        business_id: lead.business_id,
        business_name: lead.name,
        changes,
      });
    },
    [supabase, userEmail, lead.business_id, lead.name]
  );

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("lead_comments")
      .select("*")
      .eq("business_id", lead.business_id)
      .order("created_at", { ascending: false });
    setComments((data as LeadComment[]) ?? []);
  }, [supabase, lead.business_id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // El texto de notas es del lead abierto: si cambia de tarjeta, recarga.
  useEffect(() => {
    setNotes(lead.notes ?? "");
  }, [lead.business_id, lead.notes]);

  // ── Bitácora ────────────────────────────────────────────────────────────────
  async function addComment() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase
      .from("lead_comments")
      .insert({ business_id: lead.business_id, user_email: userEmail, body });
    setBusy(false);
    if (error) return notify("No se pudo guardar la nota: " + error.message, "error");
    setDraft("");
    await loadComments();
    onChanged();
    log("comment", { nota: body.slice(0, 120) });
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from("lead_comments").delete().eq("id", id);
    if (error) return notify("No se pudo borrar: " + error.message, "error");
    await loadComments();
    onChanged();
  }

  // ── Adjuntos ────────────────────────────────────────────────────────────────
  const upload = useCallback(
    async (list: FileList | File[]) => {
      const arr = Array.from(list);
      if (arr.length === 0) return;
      setUploading(arr.length);

      for (const file of arr) {
        if (file.size > MAX_MB * 1024 * 1024) {
          notify(`${file.name} pesa más de ${MAX_MB} MB`, "error");
          continue;
        }
        const path = `${lead.business_id}/${Date.now()}-${safeName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(BOARD_BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) {
          notify("No se pudo subir: " + upErr.message, "error");
          continue;
        }
        const { data: pub } = supabase.storage.from(BOARD_BUCKET).getPublicUrl(path);
        const { error: rowErr } = await supabase.from("lead_attachments").insert({
          business_id: lead.business_id,
          user_email: userEmail,
          path,
          url: pub.publicUrl,
          name: file.name,
          mime: file.type,
          size: file.size,
        });
        if (rowErr) {
          // La fila es la que manda: si no se registró, no dejes el archivo huérfano.
          await supabase.storage.from(BOARD_BUCKET).remove([path]);
          notify("No se pudo registrar el archivo: " + rowErr.message, "error");
          continue;
        }
        log("attach", { archivo: file.name });
      }

      setUploading(0);
      onChanged();
    },
    [supabase, lead.business_id, userEmail, notify, onChanged, log]
  );

  async function deleteFile(f: LeadAttachment) {
    await supabase.storage.from(BOARD_BUCKET).remove([f.path]);
    const { error } = await supabase.from("lead_attachments").delete().eq("id", f.id);
    if (error) return notify("No se pudo borrar: " + error.message, "error");
    onChanged();
  }

  // Pegar una captura directo en la tarjeta (Ctrl+V), como en Trello.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const imgs = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (imgs.length) {
        e.preventDefault();
        upload(imgs);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [upload]);

  function toggleLabel(key: string) {
    const next = labels.includes(key) ? labels.filter((k) => k !== key) : [...labels, key];
    onUpdate(lead.business_id, { board_labels: next });
  }

  const notesChanged = (lead.notes ?? "") !== notes;

  return (
    <Modal onClose={onClose} size="2xl">
      {/* Encabezado */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight text-white">{lead.name}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {[lead.industry, lead.category].filter(Boolean).join(" · ") || "Sin categoría"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Cerrar
        </button>
      </div>

      <div className="grid gap-5 overflow-y-auto overscroll-contain p-5 md:grid-cols-[1fr_240px]">
        {/* ── Columna principal ────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          {/* Estado y seguimiento: el select también sirve para mover la tarjeta
              desde el celular, donde no se puede arrastrar. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">Columna</span>
              <select
                value={statuses.includes(lead.outreach_status) ? lead.outreach_status : statuses[0]}
                onChange={(e) => onUpdate(lead.business_id, { outreach_status: e.target.value })}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">Seguimiento</span>
              <DateField
                value={lead.follow_up}
                onChange={(v) => onUpdate(lead.business_id, { follow_up: v })}
                className="w-full"
              />
            </label>
          </div>

          {/* Etiquetas */}
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Etiquetas</span>
            <div className="flex flex-wrap gap-1.5">
              {BOARD_LABELS.map((lb) => {
                const on = labels.includes(lb.key);
                return (
                  <button
                    key={lb.key}
                    onClick={() => toggleLabel(lb.key)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 transition ${
                      on ? lb.chip : "bg-slate-800 text-slate-400 ring-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${on ? lb.dot : "bg-slate-600"}`} />
                    {lb.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas fijas del lead (el mismo campo que ve la tabla y el Excel) */}
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Notas</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Contexto del negocio, qué le interesa, qué quedó pendiente…"
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
            {notesChanged && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onUpdate(lead.business_id, { notes });
                  }}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Guardar notas
                </button>
                <button
                  onClick={() => setNotes(lead.notes ?? "")}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Descartar
                </button>
              </div>
            )}
          </div>

          {/* Archivos e imágenes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                Imágenes y archivos {files.length > 0 && `(${files.length})`}
              </span>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                + Subir
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) upload(e.target.files);
                e.target.value = "";
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDropping(true);
              }}
              onDragLeave={() => setDropping(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDropping(false);
                if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
              }}
              className={`rounded-lg border border-dashed p-3 transition ${
                dropping ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700"
              }`}
            >
              {files.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-500">
                  Arrastra aquí una imagen, o pégala con Ctrl+V
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {files.map((f) => (
                    <FileTile key={f.id} file={f} onDelete={() => deleteFile(f)} />
                  ))}
                </div>
              )}
              {uploading > 0 && (
                <p className="pt-2 text-center text-xs text-indigo-400">
                  Subiendo {uploading} archivo{uploading !== 1 ? "s" : ""}…
                </p>
              )}
            </div>
          </div>

          {/* Bitácora */}
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">
              Bitácora {comments.length > 0 && `(${comments.length})`}
            </span>
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment();
                }}
                rows={2}
                placeholder="Qué pasó en este contacto…"
                className="min-w-0 flex-1 resize-y rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
              />
              <button
                onClick={addComment}
                disabled={busy || !draft.trim()}
                className="shrink-0 self-start rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Agregar
              </button>
            </div>

            {comments.length > 0 && (
              <ul className="space-y-2 pt-1">
                {comments.map((c) => (
                  <li key={c.id} className="group rounded-lg border border-slate-800 bg-slate-800/40 p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-medium text-indigo-300">
                        {c.user_email || "sistema"}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-600">{fmtDate(c.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-300">{c.body}</p>
                    {c.user_email === userEmail && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="mt-1 text-[11px] text-slate-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                      >
                        Borrar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Columna lateral: los datos del negocio ───────────────────────── */}
        <aside className="space-y-4 md:border-l md:border-slate-800 md:pl-5">
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Contacto</span>
            {phone ? (
              <div className="flex flex-wrap items-center gap-2">
                <PhoneLink phone={phone} />
                <WhatsAppLink phone={phone} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sin teléfono</p>
            )}
            {lead.address && <p className="text-xs leading-relaxed text-slate-400">{lead.address}</p>}
            <div className="flex flex-wrap gap-2">
              {lead.maps_url && <LinkButton href={lead.maps_url}>maps</LinkButton>}
              {lead.website && (
                <LinkButton href={lead.website}>{siteHost(lead.website).slice(0, 18) || "sitio"}</LinkButton>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Señales</span>
            <div className="flex flex-wrap gap-1.5">
              <span className={`rounded-md px-2 py-1 text-xs font-medium ${WEB_STYLES[web] ?? WEB_STYLES[WEB_PROPIO]}`}>
                {WEB_LABELS[web] ?? "—"}
              </span>
              <span className="rounded-md bg-slate-800 px-2 py-1 text-xs tabular-nums text-slate-300">
                Score <b className="text-white">{lead.lead_score}</b>
              </span>
              <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">{lead.priority}</span>
              {lead.rating ? (
                <span className="rounded-md bg-slate-800 px-2 py-1 text-xs tabular-nums text-amber-300">
                  ★ {lead.rating}
                  {lead.reviews_count ? <span className="text-slate-500"> ({lead.reviews_count})</span> : null}
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-600">
              1ª vez {lead.first_seen ?? "—"} · última {lead.last_seen ?? "—"}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              onClick={onEdit}
              className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Editar todos los campos
            </button>
            <button
              onClick={onDelete}
              className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              Quitar del tablero
            </button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

// ── Miniatura de archivo ───────────────────────────────────────────────────────
function FileTile({ file, onDelete }: { file: LeadAttachment; onDelete: () => void }) {
  const isImage = (file.mime ?? "").startsWith("image/");
  return (
    <div className="group relative overflow-hidden rounded-md border border-slate-700 bg-slate-800">
      <a href={file.url} target="_blank" rel="noreferrer" title={file.name} className="block">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={file.name} className="h-20 w-full object-cover" />
        ) : (
          <div className="flex h-20 flex-col items-center justify-center gap-1 px-1 text-center">
            <span className="text-lg">📄</span>
            <span className="line-clamp-2 text-[10px] leading-tight text-slate-400">{file.name}</span>
          </div>
        )}
      </a>
      <button
        onClick={onDelete}
        title="Borrar archivo"
        className="absolute right-1 top-1 hidden rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-red-300 hover:text-red-200 group-hover:block"
      >
        ✕
      </button>
      {file.size ? (
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] tabular-nums text-slate-300">
          {fmtSize(file.size)}
        </span>
      ) : null}
    </div>
  );
}
