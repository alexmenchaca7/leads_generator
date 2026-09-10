import { createClient } from "@/lib/supabase/server";
import { mergeConfig } from "@/lib/configDefaults";
import ConfigPanel from "./ConfigPanel";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: configRows } = await supabase.from("app_config").select("key,value");
  const config = mergeConfig(configRows);

  return <ConfigPanel userEmail={user?.email ?? ""} initialConfig={config} />;
}
