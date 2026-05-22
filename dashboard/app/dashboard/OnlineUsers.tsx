"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Muestra quién está conectado ahora mismo usando Supabase Presence.
export default function OnlineUsers({ userEmail }: { userEmail: string }) {
  const [online, setOnline] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("online-users", {
      config: { presence: { key: userEmail } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(Object.keys(channel.presenceState()));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ email: userEmail, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userEmail]);

  if (online.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-slate-500 sm:inline">En línea:</span>
      <div className="flex -space-x-2">
        {online.map((email) => (
          <span
            key={email}
            title={email + (email === userEmail ? " (tú)" : "")}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-indigo-600 text-xs font-semibold uppercase text-white ring-1 ring-slate-700"
          >
            {email.slice(0, 2)}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-500" />
          </span>
        ))}
      </div>
    </div>
  );
}
