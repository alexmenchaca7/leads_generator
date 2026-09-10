"use client";

import { useState } from "react";

// Link de descarga del programa (ZIP). Por defecto se sirve desde el propio
// dashboard (dashboard/public/motor-busquedas.zip). Se puede sobreescribir con
// NEXT_PUBLIC_WORKER_DOWNLOAD_URL (GitHub release, Drive, etc.).
const PROGRAM_URL = process.env.NEXT_PUBLIC_WORKER_DOWNLOAD_URL || "/motor-busquedas.zip";

export default function WorkerGuide({ online }: { online: boolean }) {
  const [open, setOpen] = useState(false); // colapsada por defecto

  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-200">
          📘 Guía: instalar y usar el sistema (paso a paso)
        </span>
        <span className="text-xs text-slate-500">{open ? "Ocultar ▲" : "Ver guía ▼"}</span>
      </button>

      {open && (
        <div className="space-y-6 border-t border-slate-800 px-4 py-4 text-sm text-slate-300">
          <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-slate-300">
            El “motor de búsquedas” es un programa que se instala <b>una sola vez</b> en una PC
            con Windows (Parte A). Después, el día a día se hace todo desde aquí (Parte B).
            La barra de arriba indica si el motor está{" "}
            <span className="text-emerald-400">conectado</span> o{" "}
            <span className="text-red-400">apagado</span>.
          </p>

          {/* PARTE A */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-indigo-300">
              Parte A · Instalación (una sola vez)
            </h3>
            <div className="space-y-4">
              <Step n={1} title="Descarga el programa">
                Descarga el programa de búsquedas y descomprímelo en una carpeta fácil de
                encontrar (por ejemplo, en el Escritorio).{" "}
                <a href={PROGRAM_URL} className="font-semibold text-indigo-400 underline hover:text-indigo-300">
                  Descargar programa (.zip)
                </a>
              </Step>

              <Step n={2} title="Instala Python">
                Entra a{" "}
                <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer"
                  className="font-semibold text-indigo-400 underline hover:text-indigo-300">
                  python.org/downloads
                </a>{" "}
                y descarga Python. Al abrir el instalador, <b>marca la casilla “Add python.exe to
                PATH”</b> (abajo) y dale <b>Install Now</b>. (Si no marcas esa casilla, no funciona.)
              </Step>

              <Step n={3} title="Instala los componentes">
                Abre la carpeta que descomprimiste y haz <b>doble clic en <code>instalar.bat</code></b>.
                Se abre una ventana negra que instala todo solo; cuando diga <b>“LISTO”</b>, ciérrala.
              </Step>

              <Step n={4} title="Descarga el archivo de conexión">
                Baja el archivo <code>conexion.env</code> (ya viene configurado) y{" "}
                <b>muévelo a la misma carpeta</b> del programa, junto a <code>start_worker.bat</code>.
                <div className="mt-2">
                  <a
                    href="/api/worker-env"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    ⬇ Descargar archivo de conexión
                  </a>
                </div>
                <span className="mt-1 block text-xs text-slate-500">
                  Se descarga como <code>conexion.env</code>. Contiene una llave privada: guárdalo
                  solo en esa PC, no lo compartas.
                </span>
              </Step>

              <Step n={5} title="Enciende el motor">
                Haz <b>doble clic en <code>start_worker.bat</code></b>. Se abre una ventana que debes
                <b> dejar abierta</b>. En unos segundos, la barra de aquí arriba se pondrá{" "}
                <span className="text-emerald-400">verde</span>.
              </Step>

              <Step n={6} title="(Opcional) Que arranque solo al prender la PC">
                Clic derecho sobre <code>start_worker.bat</code> → <b>Crear acceso directo</b>;
                renómbralo <b>“Iniciar búsquedas”</b>. Presiona <b>Windows + R</b>, escribe{" "}
                <code>shell:startup</code>, Enter, y copia ahí ese acceso directo. Listo:
                cada vez que prendas la PC, el motor arranca solo.
              </Step>
            </div>
          </div>

          {/* PARTE B */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-300">
              Parte B · Uso diario (todo desde el dashboard)
            </h3>
            <div className="space-y-4">
              <Step n={1} title="Buscar prospectos">
                Aquí abajo, haz clic en una <b>búsqueda configurada</b> o en <b>⚡ Buscar todas</b>;
                también puedes escribir una <b>búsqueda puntual</b>. Los negocios nuevos aparecen
                solos en el Dashboard (no se repiten los que ya tienes).
              </Step>
              <Step n={2} title="Filtrar los que no tienen web">
                En el Dashboard, filtra por <b>Presencia web</b>. Los{" "}
                <b className="text-emerald-300">Sin web</b> y los{" "}
                <b className="text-amber-300">Solo redes</b> son tus prospectos: no tienen un
                sitio propio. Los <b>Solo redes</b> suelen ser la venta más fácil.
              </Step>
              <Step n={3} title="Personalizar (⚙ Configurar)">
                Edita las búsquedas, ciudades, giros objetivo, qué cuenta como sitio propio y cómo
                se calcula el <b>score</b>/<b>prioridad</b>. Si cambias algo, usa{" "}
                <b>Recalcular leads</b> para reordenar los que ya tienes (el motor debe estar
                encendido).
              </Step>
              <Step n={4} title="Trabajar los leads">
                En el Dashboard editas cada negocio (estado, seguimiento, notas) y le marcas o
                le mandas WhatsApp con un clic. Todo se guarda al instante y lo ve tu equipo en vivo.
              </Step>
              <Step n={5} title="Cuenta y equipo">
                En <b>Mi cuenta</b> cambias tu contraseña. En <b>Usuarios</b> das de alta/baja a tu
                equipo y reseteas contraseñas.
              </Step>
            </div>
          </div>

          {!online && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
              Ahora mismo el motor está <b>apagado</b>. Si ya lo instalaste, abre{" "}
              <code>start_worker.bat</code> (o el acceso directo «Iniciar búsquedas»).
              Mientras esté apagado, las búsquedas quedan <b>en cola</b> y se ejecutan al encenderlo.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <div className="font-medium text-slate-100">{title}</div>
        <p className="mt-0.5 text-slate-400">{children}</p>
      </div>
    </div>
  );
}
