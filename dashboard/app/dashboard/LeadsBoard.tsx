"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Lead,
  type LeadAttachment,
  BOARD_LABEL_MAP,
  WEB_SIN,
  WEB_REDES,
  WEB_PROPIO,
  WEB_LABELS,
  WEB_STYLES,
} from "@/types";
import { cleanPhone } from "@/lib/clean";
import { PhoneLink, WhatsAppLink } from "./ui";
import CardModal from "./CardModal";

// ── Orden dentro de la columna ────────────────────────────────────────────────
// Las posiciones son fraccionarias: al soltar una tarjeta entre otras dos se le
// asigna el punto medio, así mover una tarjeta solo reescribe ESA fila en vez de
// renumerar toda la columna.
const STEP = 1000;

// Un lead recién scrapeado todavía no tiene board_position. En vez de mandarlo
// al final le damos una posición "virtual" muy negativa ordenada por score: así
// aparece arriba de su columna, que es justo donde quieres ver un prospecto
// nuevo con buen puntaje. En cuanto alguien lo arrastra recibe posición real.
const NULL_ANCHOR = -1e9;
function effPos(l: Lead): number {
  return l.board_position ?? NULL_ANCHOR + (100 - (l.lead_score ?? 0));
}

function sortColumn(arr: Lead[]): Lead[] {
  return [...arr].sort((a, b) => {
    const d = effPos(a) - effPos(b);
    if (d !== 0) return d;
    return a.business_id.localeCompare(b.business_id);
  });
}

// Estilo por columna: el color dice en qué parte del embudo estás.
const COL_STYLES: Record<string, { bar: string; text: string; ring: string }> = {
  pendiente: { bar: "bg-slate-500", text: "text-slate-300", ring: "ring-slate-500/40" },
  contactado: { bar: "bg-indigo-500", text: "text-indigo-300", ring: "ring-indigo-500/40" },
  "no contestó": { bar: "bg-amber-500", text: "text-amber-300", ring: "ring-amber-500/40" },
  interesado: { bar: "bg-emerald-500", text: "text-emerald-300", ring: "ring-emerald-500/40" },
  "no interesado": { bar: "bg-rose-500", text: "text-rose-300", ring: "ring-rose-500/40" },
  cliente: { bar: "bg-violet-500", text: "text-violet-300", ring: "ring-violet-500/40" },
};
const DEFAULT_COL = { bar: "bg-slate-500", text: "text-slate-300", ring: "ring-slate-500/40" };

const PAGE = 25; // tarjetas visibles por columna antes de "mostrar más"

type Over = { status: string; index: number } | null;

export default function LeadsBoard({
  leads,
  supabase,
  userEmail,
  statuses,
  onUpdate,
  onEdit,
  onDelete,
  notify,
}: {
  leads: Lead[];
  supabase: SupabaseClient;
  userEmail: string;
  statuses: string[];
  onUpdate: (id: string, patch: Partial<Lead>) => void | Promise<void>;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  notify: (msg: string, type?: "success" | "error") => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Over>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});

  // Conteos de la bitácora y adjuntos de cada tarjeta (para los contadores del
  // pie y la portada). Se piden ligeros: solo las columnas que se usan.
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [attachments, setAttachments] = useState<Record<string, LeadAttachment[]>>({});

  const scrollerRef = useRef<HTMLDivElement>(null);

  const loadMeta = useCallback(async () => {
    const [{ data: cRows }, { data: aRows }] = await Promise.all([
      supabase.from("lead_comments").select("business_id"),
      supabase.from("lead_attachments").select("*").order("created_at", { ascending: true }),
    ]);
    const counts: Record<string, number> = {};
    for (const r of (cRows ?? []) as { business_id: string }[]) {
      counts[r.business_id] = (counts[r.business_id] ?? 0) + 1;
    }
    const byBiz: Record<string, LeadAttachment[]> = {};
    for (const r of (aRows ?? []) as LeadAttachment[]) {
      (byBiz[r.business_id] ??= []).push(r);
    }
    setCommentCounts(counts);
    setAttachments(byBiz);
  }, [supabase]);

  useEffect(() => {
    loadMeta();
    const ch = supabase
      .channel("board-meta")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_comments" }, () => loadMeta())
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_attachments" }, () => loadMeta())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, loadMeta]);

  // Agrupa por estado. Un estado desconocido (por ejemplo si alguien cambió las
  // opciones en /config) cae en la primera columna para que nunca se pierda.
  const columns = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of statuses) map[s] = [];
    const fallback = statuses[0];
    for (const l of leads) {
      const s = l.outreach_status && map[l.outreach_status] !== undefined ? l.outreach_status : fallback;
      map[s]?.push(l);
    }
    for (const s of statuses) map[s] = sortColumn(map[s] ?? []);
    return map;
  }, [leads, statuses]);

  const dragged = dragId ? leads.find((l) => l.business_id === dragId) ?? null : null;

  // ── Soltar la tarjeta ───────────────────────────────────────────────────────
  async function drop(status: string, index: number) {
    const lead = dragged;
    setDragId(null);
    setOver(null);
    if (!lead) return;

    // La columna destino SIN la tarjeta que se está moviendo: sobre esa lista se
    // calculan los vecinos del hueco donde se soltó.
    const rest = (columns[status] ?? []).filter((l) => l.business_id !== lead.business_id);
    const before = index > 0 ? effPos(rest[index - 1]) : null;
    const after = index < rest.length ? effPos(rest[index]) : null;

    let position: number;
    if (before === null && after === null) position = STEP;
    else if (before === null) position = (after as number) - STEP;
    else if (after === null) position = before + STEP;
    else position = (before + after) / 2;

    // Si el hueco entre dos vecinos ya es demasiado chico para partirlo (pasa
    // tras muchísimas inserciones en el mismo punto), renumera la columna.
    const tooTight = before !== null && after !== null && after - before < 0.0001;

    const sameCol = lead.outreach_status === status;
    if (sameCol && lead.board_position === position) return;

    const patch: Partial<Lead> = { board_position: position };
    if (!sameCol) patch.outreach_status = status;
    await onUpdate(lead.business_id, patch);

    if (tooTight) {
      const ordered = [...rest.slice(0, index), lead, ...rest.slice(index)];
      await Promise.all(
        ordered.map((l, i) =>
          supabase.from("leads").update({ board_position: (i + 1) * STEP }).eq("business_id", l.business_id)
        )
      );
    }
  }

  // Índice de inserción a partir de la posición del cursor: el primer hueco cuyo
  // punto medio queda debajo del puntero.
  function indexFromPointer(container: HTMLElement, y: number): number {
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-card]")).filter(
      (el) => el.dataset.card !== dragId
    );
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return cards.length;
  }

  // Al arrastrar cerca de los bordes, desliza el tablero para alcanzar columnas
  // que no caben en pantalla.
  function edgeScroll(clientX: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 80;
    if (clientX - r.left < margin) el.scrollLeft -= 18;
    else if (r.right - clientX < margin) el.scrollLeft += 18;
  }

  const openLead = openId ? leads.find((l) => l.business_id === openId) ?? null : null;

  return (
    <>
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto pb-3"
        onDragOver={(e) => edgeScroll(e.clientX)}
      >
        {statuses.map((status) => {
          const items = columns[status] ?? [];
          const limit = limits[status] ?? PAGE;
          const style = COL_STYLES[status] ?? DEFAULT_COL;
          const isOver = over?.status === status;
          // Cuenta solo lo renderizado: indexFromPointer mide el DOM, así que si
          // la columna está recortada por `limit` ambos tienen que coincidir.
          const renderedRest = items.slice(0, limits[status] ?? PAGE).filter(
            (x) => x.business_id !== dragId
          ).length;

          return (
            <section
              key={status}
              className={`flex w-[286px] shrink-0 flex-col rounded-xl border bg-slate-900/80 transition ${
                isOver ? `border-transparent ring-2 ${style.ring}` : "border-slate-800"
              }`}
            >
              {/* Encabezado de columna */}
              <header className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${style.bar}`} />
                <h3 className={`min-w-0 flex-1 truncate text-sm font-semibold ${style.text}`}>{status}</h3>
                <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-xs tabular-nums text-slate-400">
                  {items.length}
                </span>
              </header>

              {/* Lista de tarjetas */}
              <div
                className="min-h-[120px] flex-1 space-y-2 overflow-y-auto p-2"
                style={{ maxHeight: "calc(100dvh - 340px)" }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const idx = indexFromPointer(e.currentTarget, e.clientY);
                  setOver((prev) =>
                    prev && prev.status === status && prev.index === idx ? prev : { status, index: idx }
                  );
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOver((prev) => (prev?.status === status ? null : prev));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const idx = indexFromPointer(e.currentTarget, e.clientY);
                  drop(status, idx);
                }}
              >
                {items.slice(0, limit).map((l, i) => {
                  // La línea de inserción se dibuja contra la lista SIN la
                  // tarjeta arrastrada, igual que el cálculo de la posición.
                  const visualIndex = dragId
                    ? items.slice(0, i).filter((x) => x.business_id !== dragId).length
                    : i;
                  const showLine =
                    isOver && dragId !== null && over?.index === visualIndex && l.business_id !== dragId;
                  return (
                    <div key={l.business_id}>
                      {showLine && <DropLine />}
                      <BoardCard
                        lead={l}
                        dragging={dragId === l.business_id}
                        comments={commentCounts[l.business_id] ?? 0}
                        files={attachments[l.business_id] ?? []}
                        onOpen={() => setOpenId(l.business_id)}
                        onDragStart={(e) => {
                          setDragId(l.business_id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", l.business_id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOver(null);
                        }}
                      />
                    </div>
                  );
                })}

                {/* Línea al final de lo visible en la columna */}
                {isOver && dragId !== null && over?.index === renderedRest && <DropLine />}

                {items.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-slate-600">
                    {dragId ? "Suelta aquí" : "Sin negocios"}
                  </p>
                )}

                {items.length > limit && (
                  <button
                    onClick={() => setLimits((p) => ({ ...p, [status]: limit + PAGE }))}
                    className="w-full rounded-lg border border-slate-700 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Mostrar {Math.min(PAGE, items.length - limit)} más de {items.length - limit}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {openLead && (
        <CardModal
          lead={openLead}
          supabase={supabase}
          userEmail={userEmail}
          statuses={statuses}
          files={attachments[openLead.business_id] ?? []}
          onClose={() => setOpenId(null)}
          onUpdate={onUpdate}
          onEdit={() => {
            setOpenId(null);
            onEdit(openLead);
          }}
          onDelete={() => {
            setOpenId(null);
            onDelete(openLead);
          }}
          onChanged={loadMeta}
          notify={notify}
        />
      )}
    </>
  );
}

function DropLine() {
  return <div className="mb-2 h-0.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />;
}

// ── Tarjeta del tablero ────────────────────────────────────────────────────────
function BoardCard({
  lead: l,
  dragging,
  comments,
  files,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  dragging: boolean;
  comments: number;
  files: LeadAttachment[];
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const phone = cleanPhone(l.phone);
  const cover = files.find((f) => (f.mime ?? "").startsWith("image/"));
  const labels = (l.board_labels ?? []).map((k) => BOARD_LABEL_MAP[k]).filter(Boolean);
  const status = l.web_status ?? WEB_PROPIO;

  // Borde izquierdo por presencia web: verde = sin sitio propio (mejor
  // prospecto), ámbar = solo redes.
  const edge =
    status === WEB_SIN
      ? "border-l-emerald-500"
      : status === WEB_REDES
        ? "border-l-amber-500"
        : "border-l-slate-700";

  return (
    <article
      data-card={l.business_id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`cursor-grab overflow-hidden rounded-lg border border-slate-800 border-l-[3px] ${edge} bg-slate-800/60 shadow-sm transition hover:border-slate-600 hover:bg-slate-800 active:cursor-grabbing ${
        dragging ? "opacity-30" : ""
      }`}
    >
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt="" className="h-24 w-full object-cover" draggable={false} />
      )}

      <div className="space-y-2 p-2.5">
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {labels.map((lb) => (
              <span key={lb.key} title={lb.label} className={`h-1.5 w-8 rounded-full ${lb.dot}`} />
            ))}
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium leading-snug text-slate-100">{l.name}</h4>
          {(l.industry || l.category) && (
            <p className="truncate text-[11px] text-slate-500">{l.industry || l.category}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${WEB_STYLES[status] ?? WEB_STYLES[WEB_PROPIO]}`}
          >
            {WEB_LABELS[status] ?? "—"}
          </span>
          <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-300">
            {l.lead_score} pts
          </span>
          {l.rating ? (
            <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-300">
              ★ {l.rating}
              {l.reviews_count ? <span className="text-slate-500"> ({l.reviews_count})</span> : null}
            </span>
          ) : null}
        </div>

        {phone && (
          <div
            className="flex items-center gap-2 text-xs"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          >
            <PhoneLink phone={phone} compact />
            <WhatsAppLink phone={phone} />
          </div>
        )}

        {(l.follow_up || l.notes || comments > 0 || files.length > 0) && (
          <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-700/60 pt-1.5 text-[11px] text-slate-500">
            {l.follow_up && (
              <span className="inline-flex items-center gap-1 tabular-nums" title="Seguimiento">
                <CalIcon /> {l.follow_up.slice(5)}
              </span>
            )}
            {l.notes && (
              <span title="Tiene notas">
                <LinesIcon />
              </span>
            )}
            {comments > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums" title="Notas de la bitácora">
                <ChatIcon /> {comments}
              </span>
            )}
            {files.length > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums" title="Archivos">
                <ClipIcon /> {files.length}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function CalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function LinesIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function ClipIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
