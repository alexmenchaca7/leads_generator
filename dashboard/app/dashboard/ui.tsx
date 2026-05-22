"use client";

// Campo de fecha con tamaño consistente y placeholder visible (arregla iOS).
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
    <div className="relative inline-flex items-center">
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={`${has ? "has-value " : ""}min-w-[140px] rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-indigo-500 ${className}`}
      />
      {!has && (
        <span className="pointer-events-none absolute left-2 text-xs text-slate-500">
          dd/mm/aaaa
        </span>
      )}
    </div>
  );
}

// Enlace con aspecto de botón.
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
