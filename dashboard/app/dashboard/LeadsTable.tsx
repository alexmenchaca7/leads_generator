"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Lead, OUTREACH_OPTIONS, CONTACTED_OPTIONS } from "@/types";
import { DateField, LinkButton, PhoneLink, Modal } from "./ui";
import { cleanPhone } from "@/lib/clean";
import EditModal from "./EditModal";
import BlocklistModal from "./BlocklistModal";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
  medium: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  low: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30",
};
const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const PAGE_SIZES = [25, 50, 100];

const INPUT =
  "rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500";

function rowClass(lead: Lead): string {
  if (lead.no_website && lead.priority === "high")
    return "bg-amber-500/[0.07] hover:bg-amber-500/10";
  if (lead.no_website) return "bg-emerald-500/[0.04] hover:bg-slate-800/50";
  return "hover:bg-slate-800/50";
}

type SortKey =
  | "name" | "category" | "rating" | "reviews_count" | "lead_score"
  | "priority" | "outreach_status" | "contacted" | "follow_up";

type Toast = { id: number; msg: string; type: "success" | "error" };

export default function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [supabase] = useState(() => createClient());
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "lead_score",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [saving, setSaving] = useState<string | null>(null);
  const [notesLead, setNotesLead] = useState<Lead | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editState, setEditState] = useState<{ mode: "edit" | "create"; lead: Lead | null } | null>(null);
  const [confirmLead, setConfirmLead] = useState<Lead | null>(null);
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);

  function notify(msg: string, type: "success" | "error" = "success") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }

  async function refreshBlockedCount() {
    const { count } = await supabase
      .from("blocklist")
      .select("*", { count: "exact", head: true });
    setBlockedCount(count ?? 0);
  }

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    refreshBlockedCount();
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
            return exists
              ? prev.map((l) => (l.business_id === row.business_id ? row : l))
              : [...prev, row];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    setPage(1);
  }, [search, colFilters, pageSize]);

  // ── Mutaciones ───────────────────────────────────────────────────────────────
  async function updateLead(id: string, patch: Partial<Lead>) {
    const name = patch.name ?? leads.find((l) => l.business_id === id)?.name ?? "";
    setSaving(id);
    setLeads((prev) =>
      prev.map((l) => (l.business_id === id ? { ...l, ...patch } : l))
    );
    const { error } = await supabase.from("leads").update(patch).eq("business_id", id);
    setSaving(null);
    if (error) return notify("No se pudo guardar: " + error.message, "error");
    notify(`✓ Guardado: ${name}`);
  }

  async function insertLead(values: Lead) {
    setEditState(null);
    setLeads((prev) => [values, ...prev]);
    const { error } = await supabase.from("leads").insert(values);
    if (error) {
      setLeads((prev) => prev.filter((l) => l.business_id !== values.business_id));
      return notify("No se pudo agregar: " + error.message, "error");
    }
    notify(`✓ Agregado: ${values.name}`);
  }

  function saveEdit(values: Lead, mode: "edit" | "create") {
    if (mode === "create") {
      insertLead(values);
    } else {
      setEditState(null);
      const { business_id, updated_at: _u, ...patch } = values;
      void _u;
      updateLead(business_id, patch);
    }
  }

  async function performDelete(lead: Lead) {
    setConfirmLead(null);
    setLeads((prev) => prev.filter((l) => l.business_id !== lead.business_id));
    // Vetar guardando copia de datos (para poder recuperarlo)
    await supabase
      .from("blocklist")
      .upsert(
        { business_id: lead.business_id, name: lead.name, data: lead },
        { onConflict: "business_id" }
      );
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("business_id", lead.business_id);
    if (error) return notify("No se pudo eliminar: " + error.message, "error");
    notify(`✓ Vetado: ${lead.name}`);
    setBlockedCount((c) => c + 1);
  }

  function onRecovered(lead: Lead) {
    setLeads((prev) =>
      prev.some((l) => l.business_id === lead.business_id) ? prev : [lead, ...prev]
    );
    setBlockedCount((c) => Math.max(0, c - 1));
  }

  function setColFilter(key: string, val: string) {
    setColFilters((prev) => ({ ...prev, [key]: val }));
  }
  function clearFilters() {
    setSearch("");
    setColFilters({});
  }
  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const categories = useMemo(
    () =>
      Array.from(new Set(leads.map((l) => l.category).filter(Boolean))).sort() as string[],
    [leads]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = colFilters;
    return leads.filter((l) => {
      if (q) {
        const hay =
          `${l.name} ${l.category ?? ""} ${l.address ?? ""} ${l.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.name && !l.name.toLowerCase().includes(f.name.toLowerCase())) return false;
      if (f.phone && !(l.phone ?? "").toLowerCase().includes(f.phone.toLowerCase())) return false;
      if (f.category && f.category !== "all" && l.category !== f.category) return false;
      if (f.web === "nw" && !l.no_website) return false;
      if (f.web === "w" && l.no_website) return false;
      if (f.priority && f.priority !== "all" && l.priority !== f.priority) return false;
      if (f.outreach_status && f.outreach_status !== "all" && l.outreach_status !== f.outreach_status) return false;
      if (f.contacted && f.contacted !== "all" && l.contacted !== f.contacted) return false;
      return true;
    });
  }, [leads, search, colFilters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const mul = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (sort.key === "priority") {
        return ((PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0)) * mul;
      }
      let av = a[sort.key] as string | number | null;
      let bv = b[sort.key] as string | number | null;
      av = av ?? "";
      bv = bv ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av).localeCompare(String(bv), "es", { numeric: true }) * mul;
    });
    return arr;
  }, [filtered, sort]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  function changePage(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const stats = useMemo(
    () => ({
      total: leads.length,
      sinWeb: leads.filter((l) => l.no_website).length,
      alta: leads.filter((l) => l.priority === "high").length,
      contactados: leads.filter((l) => l.contacted === "sí").length,
    }),
    [leads]
  );

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total leads" value={stats.total} accent="text-white" />
        <Stat label="Sin sitio web" value={stats.sinWeb} accent="text-emerald-400" />
        <Stat label="Prioridad alta" value={stats.alta} accent="text-red-400" />
        <Stat label="Contactados" value={stats.contactados} accent="text-indigo-400" />
      </div>

      {/* Barra superior */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEditState({ mode: "create", lead: null })}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            + Nuevo lead
          </button>
          <button
            onClick={() => setShowBlocklist(true)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Vetados{blockedCount > 0 ? ` (${blockedCount})` : ""}
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en todo…"
            className="min-w-[160px] flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
          />
          <button
            onClick={clearFilters}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Limpiar
          </button>
          <button
            onClick={() => setShowMobileFilters((v) => !v)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 lg:hidden"
          >
            Filtros
          </button>
          <span className="ml-auto whitespace-nowrap text-sm text-slate-400">
            {total} resultados
            {saving && <span className="ml-2 text-indigo-400">guardando…</span>}
          </span>
        </div>

        {showMobileFilters && (
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            <FilterSelect value={colFilters.category ?? "all"} onChange={(v) => setColFilter("category", v)} label="Categoría"
              options={[["all", "Todas"], ...categories.map((c) => [c, c] as [string, string])]} />
            <FilterSelect value={colFilters.web ?? "all"} onChange={(v) => setColFilter("web", v)} label="Web"
              options={[["all", "Todos"], ["nw", "Sin web"], ["w", "Con web"]]} />
            <FilterSelect value={colFilters.priority ?? "all"} onChange={(v) => setColFilter("priority", v)} label="Prioridad"
              options={[["all", "Todas"], ["high", "Alta"], ["medium", "Media"], ["low", "Baja"]]} />
            <FilterSelect value={colFilters.outreach_status ?? "all"} onChange={(v) => setColFilter("outreach_status", v)} label="Estado"
              options={[["all", "Todos"], ...OUTREACH_OPTIONS.map((o) => [o, o] as [string, string])]} />
            <FilterSelect value={colFilters.contacted ?? "all"} onChange={(v) => setColFilter("contacted", v)} label="Contactado"
              options={[["all", "Todos"], ...CONTACTED_OPTIONS.map((o) => [o, o] as [string, string])]} />
          </div>
        )}
      </div>

      {/* ── ESCRITORIO: tabla ──────────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 lg:block">
        <table className="w-full min-w-[1220px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-800">
              <Th label="Negocio" sortKey="name" sort={sort} onSort={toggleSort} />
              <Th label="Categoría" sortKey="category" sort={sort} onSort={toggleSort} />
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Teléfono</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Web</th>
              <Th label="Rating" sortKey="rating" sort={sort} onSort={toggleSort} />
              <Th label="Score" sortKey="lead_score" sort={sort} onSort={toggleSort} />
              <Th label="Prioridad" sortKey="priority" sort={sort} onSort={toggleSort} />
              <Th label="Estado" sortKey="outreach_status" sort={sort} onSort={toggleSort} />
              <Th label="Contactado" sortKey="contacted" sort={sort} onSort={toggleSort} />
              <Th label="Seguimiento" sortKey="follow_up" sort={sort} onSort={toggleSort} />
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Notas</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Enlaces</th>
              <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Acciones</th>
            </tr>
            <tr className="border-b border-slate-800 bg-slate-900/60">
              <td className="px-2 py-1.5">
                <input value={colFilters.name ?? ""} onChange={(e) => setColFilter("name", e.target.value)} placeholder="filtrar…" className={INPUT + " w-full min-w-[120px]"} />
              </td>
              <td className="px-2 py-1.5">
                <select value={colFilters.category ?? "all"} onChange={(e) => setColFilter("category", e.target.value)} className={INPUT + " w-full min-w-[120px]"}>
                  <option value="all">Todas</option>
                  {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </td>
              <td className="px-2 py-1.5">
                <input value={colFilters.phone ?? ""} onChange={(e) => setColFilter("phone", e.target.value)} placeholder="filtrar…" className={INPUT + " w-full min-w-[110px]"} />
              </td>
              <td className="px-2 py-1.5">
                <select value={colFilters.web ?? "all"} onChange={(e) => setColFilter("web", e.target.value)} className={INPUT + " w-full min-w-[90px]"}>
                  <option value="all">Todos</option>
                  <option value="nw">Sin web</option>
                  <option value="w">Con web</option>
                </select>
              </td>
              <td /><td />
              <td className="px-2 py-1.5">
                <select value={colFilters.priority ?? "all"} onChange={(e) => setColFilter("priority", e.target.value)} className={INPUT + " w-full min-w-[90px]"}>
                  <option value="all">Todas</option>
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
              </td>
              <td className="px-2 py-1.5">
                <select value={colFilters.outreach_status ?? "all"} onChange={(e) => setColFilter("outreach_status", e.target.value)} className={INPUT + " w-full min-w-[110px]"}>
                  <option value="all">Todos</option>
                  {OUTREACH_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                </select>
              </td>
              <td className="px-2 py-1.5">
                <select value={colFilters.contacted ?? "all"} onChange={(e) => setColFilter("contacted", e.target.value)} className={INPUT + " w-full min-w-[80px]"}>
                  <option value="all">Todos</option>
                  {CONTACTED_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                </select>
              </td>
              <td /><td /><td />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-300">
            {pageRows.map((l) => (
              <tr key={l.business_id} className={rowClass(l)}>
                <td className="px-3 py-2 font-medium text-slate-100">{l.name}</td>
                <td className="px-3 py-2 text-slate-400">{l.category}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {cleanPhone(l.phone) ? <PhoneLink phone={cleanPhone(l.phone)} /> : "—"}
                </td>
                <td className="px-3 py-2">
                  {l.no_website ? (
                    <span className="whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">Sin web</span>
                  ) : (
                    <span className="whitespace-nowrap rounded-full bg-slate-700/50 px-2 py-0.5 text-xs font-medium text-slate-400">Con web</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {l.rating ? `${l.rating}★` : "—"}
                  <span className="text-xs text-slate-500">{l.reviews_count ? ` (${l.reviews_count})` : ""}</span>
                </td>
                <td className="px-3 py-2 font-semibold text-slate-100">{l.lead_score}</td>
                <td className="px-3 py-2">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[l.priority] ?? PRIORITY_STYLES.low}`}>{l.priority}</span>
                </td>
                <td className="px-3 py-2">
                  <select value={l.outreach_status ?? "pendiente"} onChange={(e) => updateLead(l.business_id, { outreach_status: e.target.value })} className={INPUT}>
                    {OUTREACH_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select value={l.contacted ?? "no"} onChange={(e) => updateLead(l.business_id, { contacted: e.target.value })} className={INPUT}>
                    {CONTACTED_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <DateField value={l.follow_up} onChange={(v) => updateLead(l.business_id, { follow_up: v })} />
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => setNotesLead(l)} className="flex max-w-[160px] items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-indigo-500">
                    <NoteIcon />
                    <span className="truncate">{l.notes ? l.notes : <span className="text-slate-500">agregar</span>}</span>
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    {!l.no_website && l.website && <LinkButton href={l.website}>sitio</LinkButton>}
                    {l.maps_url && <LinkButton href={l.maps_url}>maps</LinkButton>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setEditState({ mode: "edit", lead: l })} title="Editar" className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400">
                      <EditIcon />
                    </button>
                    <button onClick={() => setConfirmLead(l)} title="Eliminar (vetar)" className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={13} className="px-3 py-12 text-center text-slate-500">No hay leads que coincidan con los filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── MÓVIL/TABLET: tarjetas ─────────────────────────────────────────── */}
      <div className="space-y-3 lg:hidden">
        {pageRows.map((l) => (
          <LeadCard
            key={l.business_id}
            lead={l}
            onUpdate={updateLead}
            onDelete={() => setConfirmLead(l)}
            onEdit={() => setEditState({ mode: "edit", lead: l })}
            onNotes={() => setNotesLead(l)}
          />
        ))}
        {pageRows.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-12 text-center text-slate-500">No hay leads que coincidan con los filtros.</div>
        )}
      </div>

      {/* Paginación */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <span>Filas:</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className={INPUT}>
            {PAGE_SIZES.map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
          <span className="whitespace-nowrap">
            · {total === 0 ? "0" : `${start + 1}–${Math.min(start + pageSize, total)}`} de {total}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <PageBtn onClick={() => changePage(1)} disabled={current === 1}>«</PageBtn>
          <PageBtn onClick={() => changePage(current - 1)} disabled={current === 1}>‹</PageBtn>
          <span className="whitespace-nowrap px-2 text-slate-300">{current}/{totalPages}</span>
          <PageBtn onClick={() => changePage(current + 1)} disabled={current === totalPages}>›</PageBtn>
          <PageBtn onClick={() => changePage(totalPages)} disabled={current === totalPages}>»</PageBtn>
        </div>
      </div>

      {/* Modales */}
      {notesLead && (
        <NotesModal
          lead={notesLead}
          onClose={() => setNotesLead(null)}
          onSave={(text) => {
            updateLead(notesLead.business_id, { notes: text });
            setNotesLead(null);
          }}
        />
      )}
      {editState && (
        <EditModal
          mode={editState.mode}
          lead={editState.lead}
          onClose={() => setEditState(null)}
          onSave={saveEdit}
        />
      )}
      {showBlocklist && (
        <BlocklistModal
          supabase={supabase}
          onClose={() => setShowBlocklist(false)}
          onRecovered={onRecovered}
          notify={notify}
        />
      )}
      {confirmLead && (
        <ConfirmModal
          lead={confirmLead}
          onCancel={() => setConfirmLead(null)}
          onConfirm={() => performDelete(confirmLead)}
        />
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${
              t.type === "error" ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tarjeta móvil ──────────────────────────────────────────────────────────────
function LeadCard({
  lead: l,
  onUpdate,
  onDelete,
  onEdit,
  onNotes,
}: {
  lead: Lead;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
  onDelete: () => void;
  onEdit: () => void;
  onNotes: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-100">{l.name}</div>
          <div className="truncate text-xs text-slate-400">{l.category}</div>
        </div>
        <div className="flex items-center gap-1">
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[l.priority] ?? PRIORITY_STYLES.low}`}>{l.priority}</span>
          <button onClick={onEdit} className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400"><EditIcon /></button>
          <button onClick={onDelete} className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"><TrashIcon /></button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {cleanPhone(l.phone) ? (
          <PhoneLink phone={cleanPhone(l.phone)} />
        ) : (
          <span className="text-sm text-slate-500">Sin teléfono</span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-amber-300">
            ★ {l.rating ?? "—"}
            {l.reviews_count ? <span className="text-slate-500">({l.reviews_count})</span> : null}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">
            Score <b className="text-white">{l.lead_score}</b>
          </span>
          {l.no_website ? (
            <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">Sin web</span>
          ) : (
            <span className="rounded-md bg-slate-700/50 px-2 py-1 text-xs font-medium text-slate-400">Con web</span>
          )}
        </div>
        {(l.website && !l.no_website) || l.maps_url ? (
          <div className="flex flex-wrap gap-2">
            {!l.no_website && l.website && <LinkButton href={l.website}>sitio</LinkButton>}
            {l.maps_url && <LinkButton href={l.maps_url}>maps</LinkButton>}
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Estado</span>
          <select value={l.outreach_status ?? "pendiente"} onChange={(e) => onUpdate(l.business_id, { outreach_status: e.target.value })} className={INPUT + " w-full"}>
            {OUTREACH_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Contactado</span>
          <select value={l.contacted ?? "no"} onChange={(e) => onUpdate(l.business_id, { contacted: e.target.value })} className={INPUT + " w-full"}>
            {CONTACTED_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Seguimiento</span>
          <DateField value={l.follow_up} onChange={(v) => onUpdate(l.business_id, { follow_up: v })} className="w-full" />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Notas</span>
          <button onClick={onNotes} className="flex w-full items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300">
            <NoteIcon />
            <span className="truncate">{l.notes ? l.notes : "agregar"}</span>
          </button>
        </label>
      </div>
    </div>
  );
}

// ── Modal de notas ─────────────────────────────────────────────────────────────
function NotesModal({
  lead,
  onClose,
  onSave,
}: {
  lead: Lead;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(lead.notes ?? "");
  return (
    <Modal onClose={onClose} size="md">
      <div className="overflow-y-auto overscroll-contain p-5">
        <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Notas de</div>
        <h3 className="mb-3 text-lg font-semibold text-white">{lead.name}</h3>
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={10}
          placeholder="Escribe aquí notas detalladas: contexto, conversaciones, próximos pasos…"
          className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
          <button onClick={() => onSave(text)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Guardar</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal de confirmación de borrado ───────────────────────────────────────────
function ConfirmModal({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: Lead;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} size="sm">
      <div className="p-6">
        <h3 className="mb-2 text-lg font-semibold text-white">¿Vetar este negocio?</h3>
        <p className="mb-5 text-sm text-slate-400">
          <span className="font-medium text-slate-200">{lead.name}</span> se eliminará del tablero y el scraper
          no lo volverá a agregar. Podrás recuperarlo después desde el botón <span className="text-slate-200">Vetados</span>.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">Sí, vetar</button>
        </div>
      </div>
    </Modal>
  );
}

function FilterSelect({
  value, onChange, label, options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: [string, string][];
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT + " w-full"}>
        {options.map(([v, t]) => (<option key={v} value={v}>{t}</option>))}
      </select>
    </label>
  );
}

function Stat({ label, value, accent = "text-white" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Th({
  label, sortKey, sort, onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="whitespace-nowrap px-3 py-2 font-semibold">
      <button onClick={() => onSort(sortKey)} className={`flex items-center gap-1 transition hover:text-slate-200 ${active ? "text-indigo-400" : ""}`}>
        {label}
        <span className="text-[10px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </button>
  );
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
