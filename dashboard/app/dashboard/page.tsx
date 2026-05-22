import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/types";
import LeadsTable from "./LeadsTable";
import SignOutButton from "./SignOutButton";
import IdleTimeout from "./IdleTimeout";
import OnlineUsers from "./OnlineUsers";

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
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads Dashboard</h1>
          <p className="text-sm text-slate-400">{userEmail}</p>
        </div>
        <div className="flex items-center gap-3">
          <OnlineUsers userEmail={userEmail} />
          <SignOutButton />
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
