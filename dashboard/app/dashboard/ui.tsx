"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

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
export function PhoneLink({ phone }: { phone: string }) {
  const tel = phone.replace(/[^\d+]/g, "");
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
      {phone}
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
