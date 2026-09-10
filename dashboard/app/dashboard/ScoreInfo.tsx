"use client";

import { useState } from "react";
import type { ScoringWeights, PriorityThresholds } from "@/types";
import { Modal } from "./ui";

type Props = {
  weights: ScoringWeights;
  thresholds: PriorityThresholds;
};

// Explicación legible de cómo se calcula el score y la prioridad, generada a
// partir de los valores ACTUALES (así queda fiel aunque se editen en /config).
export function ScoreInfo({ weights, thresholds }: Props) {
  const Row = ({ label, pts }: { label: string; pts: number }) => (
    <li className="flex items-center justify-between gap-3">
      <span className="text-slate-300">{label}</span>
      <span className="font-mono font-semibold text-emerald-300">+{pts}</span>
    </li>
  );

  return (
    <div className="space-y-4 text-sm">
      <p className="text-slate-400">
        El <b className="text-slate-200">score</b> mide qué tan buen prospecto es cada
        negocio <b className="text-slate-200">para venderle un sitio web</b>. Suma puntos así:
      </p>

      <ul className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <li className="text-xs uppercase tracking-wide text-slate-500">Presencia web (lo más importante)</li>
        <Row label="No tiene nada en internet" pts={weights.no_website} />
        <Row label="Solo Facebook / Instagram / página gratis" pts={weights.only_social} />
        <li className="pt-1 text-xs uppercase tracking-wide text-slate-500">Giro del negocio</li>
        <Row label="Es de un giro donde un sitio web se vende bien" pts={weights.target_industry} />
        <li className="pt-1 text-xs uppercase tracking-wide text-slate-500">Tamaño (¿tiene con qué pagar?)</li>
        <Row label="100 reseñas o más" pts={weights.reviews_high} />
        <Row label="50 a 99 reseñas" pts={weights.reviews_medium} />
        <Row label="20 a 49 reseñas" pts={weights.reviews_low} />
        <li className="pt-1 text-xs uppercase tracking-wide text-slate-500">Reputación y contacto</li>
        <Row label="Rating 4.5 o más" pts={weights.rating_excellent} />
        <Row label="Rating 4.0 a 4.4" pts={weights.rating_good} />
        <Row label="Tiene teléfono" pts={weights.has_phone} />
      </ul>

      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <p className="text-slate-400">Según el score total, la <b className="text-slate-200">prioridad</b> es:</p>
        <ul className="space-y-1">
          <li className="flex items-center gap-2">
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">alta</span>
            <span className="text-slate-400">score ≥ {thresholds.high}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">media</span>
            <span className="text-slate-400">score ≥ {thresholds.medium}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-medium text-slate-300">baja</span>
            <span className="text-slate-400">lo demás</span>
          </li>
        </ul>
      </div>

      <p className="rounded-lg bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
        Importante: un negocio que <b>ya tiene sitio propio</b> siempre queda en prioridad
        <b> baja</b>, por más grande que sea, porque no es prospecto para venderle un sitio nuevo.
      </p>

      <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        Los <b>«Solo redes»</b> son oro: el negocio ya entendió que necesita estar en línea,
        pero lo resolvió con un Facebook o una página gratis. Es la venta más fácil.
      </p>
    </div>
  );
}

// Botón que abre la explicación del score en un modal. Si recibe `label`,
// muestra texto + ícono (para una barra de herramientas); si no, solo el ícono.
export function ScoreInfoButton({ weights, thresholds, label }: Props & { label?: string }) {
  const [open, setOpen] = useState(false);
  const Icon = (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
  return (
    <>
      {label ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-indigo-500 hover:text-indigo-300"
        >
          {Icon}
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="¿Cómo se calcula el score?"
          aria-label="¿Cómo se calcula el score?"
          className="inline-flex items-center text-slate-500 transition hover:text-indigo-400"
        >
          {Icon}
        </button>
      )}
      {open && (
        <Modal onClose={() => setOpen(false)} size="md">
          <div className="overflow-y-auto overscroll-contain p-5">
            <h3 className="mb-3 text-lg font-semibold text-white">¿Cómo se calcula el score?</h3>
            <ScoreInfo weights={weights} thresholds={thresholds} />
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Entendido
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
