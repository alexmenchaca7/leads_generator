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

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? "";

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .order("lead_score", { ascending: false });

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
        <LeadsTable initialLeads={(leads ?? []) as Lead[]} userEmail={userEmail} config={config} />
      )}
    </main>
  );
}
