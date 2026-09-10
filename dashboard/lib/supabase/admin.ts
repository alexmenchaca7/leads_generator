import { createClient } from "@supabase/supabase-js";

// Cliente con la SERVICE ROLE key — SOLO para uso en el servidor (route handlers).
// Usa SUPABASE_SERVICE_ROLE_KEY, que NUNCA debe ser NEXT_PUBLIC ni llegar al navegador.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
