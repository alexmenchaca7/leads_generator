import { createClient } from "@/lib/supabase/server";
import ScrapePanel from "./ScrapePanel";

export const dynamic = "force-dynamic";

export default async function ScrapePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <ScrapePanel userEmail={user?.email ?? ""} />;
}
