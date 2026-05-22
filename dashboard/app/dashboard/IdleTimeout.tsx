"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Cierra la sesión tras este tiempo sin actividad (seguridad).
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

export default function IdleTimeout() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function logout() {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    }

    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(logout, TIMEOUT_MS);
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [router]);

  return null;
}
