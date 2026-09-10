import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminPanel from "./AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Todos los usuarios autenticados pueden administrar usuarios.
  if (!user) redirect("/login");

  return <AdminPanel currentUserEmail={user.email ?? ""} />;
}
