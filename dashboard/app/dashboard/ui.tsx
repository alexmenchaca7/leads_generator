"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { phoneTel, phoneDisplay, phoneDisplayShort, phoneWa } from "@/lib/clean";

// Logo de la agencia (archivo en dashboard/public/logo.png).
export function Logo({ className = "h-8" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="Logo" className={`${className} w-auto`} />;
}

// ── Modal reutilizable ─────────────────────────────────────────────────────────
// Bloquea el scroll del fondo mientras está abierto (evita que el sistema se trabe)
// y limita la altura: el contenido interno hace scroll sin cortar header/footer.
const SIZES: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-xl",
  xl: "max-w-2xl",
};

export function Modal({
  onClose,
  children,
  size = "md",
}: {
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  // Bloquea el scroll del fondo SIN saltar al inicio: fija el <body> en su
  // posición actual (técnica estándar para iOS, donde overflow:hidden en <html>
  // resetea el scroll). Al cerrar restaura la posición exacta.
  useEffect(() => {
    const scrollY = window.scrollY;
    const { body } = document;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, []);

  if (typeof document === "undefined") return null;

  // Portal a <body>: el overlay escapa de cualquier contenedor con transform/
  // filter y siempre cubre la pantalla completa.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90dvh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

// ── Campo de fecha (tamaño uniforme + placeholder, arregla iOS) ─────────────────
export function DateField({
  value,
  onChange,
  className = "",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  className?: string;
}) {
  const has = !!value;
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={`${has ? "has-value " : ""}w-full min-w-[104px] rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-indigo-500`}
      />
      {!has && (
        <span className="pointer-events-none absolute left-2 text-xs text-slate-500">
          dd/mm/aaaa
        </span>
      )}
    </div>
  );
}

// ── Teléfono marcable (tel:) ────────────────────────────────────────────────────
export function PhoneLink({ phone, compact = false }: { phone: string; compact?: boolean }) {
  const tel = phoneTel(phone);
  return (
    <a
      href={`tel:${tel}`}
      className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-indigo-300 transition hover:text-indigo-200 hover:underline"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
      </svg>
      {compact ? phoneDisplayShort(phone) : phoneDisplay(phone)}
    </a>
  );
}

// ── Boton de WhatsApp (abre el chat, sin mensaje pre-cargado) ───────────────────
export function WhatsAppLink({ phone }: { phone: string }) {
  const wa = phoneWa(phone);
  if (!wa) return null;
  return (
    <a
      href={`https://wa.me/${wa}`}
      target="_blank"
      rel="noreferrer"
      title="Enviar WhatsApp"
      aria-label="Enviar WhatsApp"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-emerald-400 transition hover:bg-emerald-500/10 hover:text-emerald-300"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.739-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
      </svg>
    </a>
  );
}

// ── Enlace con aspecto de botón ─────────────────────────────────────────────────
export function LinkButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-indigo-300 transition hover:border-indigo-500 hover:bg-slate-700 hover:text-indigo-200"
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </svg>
    </a>
  );
}
