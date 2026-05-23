import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/types";
import Link from "next/link";
import LeadsTable from "./LeadsTable";
import SignOutButton from "./SignOutButton";
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

  return (
    <main className="mx-auto max-w-[1700px] px-4 py-6">
      <IdleTimeout />
      <header className="mb-6 space-y-3 sm:flex sm:items-center sm:justify-between sm:space-y-0">
        <div className="space-y-1">
          <Logo className="h-9" />
          <p className="text-sm text-slate-400">{userEmail}</p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <OnlineUsers userEmail={userEmail} />
          <div className="flex gap-2">
            <Link
              href="/scrape"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              + Buscar
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Error cargando datos: {error.message}
        </div>
      ) : (
        <LeadsTable initialLeads={(leads ?? []) as Lead[]} userEmail={userEmail} />
      )}
    </main>
  );
}
