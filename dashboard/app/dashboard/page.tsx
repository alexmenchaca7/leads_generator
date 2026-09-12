import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/types";
import { mergeConfig } from "@/lib/configDefaults";
import Link from "next/link";
import LeadsTable from "./LeadsTable";
import SignOutButton from "./SignOutButton";
import AccountButton from "./AccountButton";
import IdleTimeout from "./IdleTimeout";
import OnlineUsers from "./OnlineUsers";
import { Logo } from "./ui";

export const dynamic = "force-dynamic";

// Supabase (PostgREST) devuelve como máximo 1000 filas por consulta, sin avisar:
// pasando ese número el dashboard simplemente dejaba de ver leads. Aquí se piden
// por tandas hasta que una venga incompleta. El desempate por business_id es
// necesario: sin él, dos leads con el mismo score pueden cambiar de orden entre
// tandas y colarse repetidos o perderse.
async function fetchAllLeads(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ data: Lead[]; error: { message: string } | null }> {
  const CHUNK = 1000;
  const all: Lead[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("lead_score", { ascending: false })
      .order("business_id", { ascending: true })
      .range(from, from + CHUNK - 1);
    if (error) return { data: all, error };
    all.push(...((data ?? []) as Lead[]));
    if (!data || data.length < CHUNK) break;
  }
  return { data: all, error: null };
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? "";

  const { data: leads, error } = await fetchAllLeads(supabase);

  const { data: configRows } = await supabase.from("app_config").select("key,value");
  const config = mergeConfig(configRows);

  return (
    <main className="mx-auto max-w-[1700px] px-4 py-6">
      <IdleTimeout />
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <Logo className="h-9" />
          <p className="truncate text-sm text-slate-400">{userEmail}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex justify-end">
            <OnlineUsers userEmail={userEmail} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Link
              href="/scrape"
              className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-500 sm:col-span-1"
            >
              + Buscar
            </Link>
            <Link
              href="/guia"
              title="Guiones de WhatsApp y proceso de venta"
              className="rounded-lg border border-slate-700 px-3 py-2 text-center text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              📘 Guía
            </Link>
            <Link
              href="/config"
              className="rounded-lg border border-slate-700 px-3 py-2 text-center text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              ⚙ Configurar
            </Link>
            <Link
              href="/admin"
              className="rounded-lg border border-slate-700 px-3 py-2 text-center text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              Usuarios
            </Link>
            <AccountButton userEmail={userEmail} />
            <SignOutButton />
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Error cargando datos: {error.message}
        </div>
      ) : (
        <LeadsTable initialLeads={leads} userEmail={userEmail} config={config} />
      )}
    </main>
  );
}
