import { createBrowserClient } from "@supabase/ssr";

// Cliente para componentes del navegador (edición en vivo + Realtime).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
