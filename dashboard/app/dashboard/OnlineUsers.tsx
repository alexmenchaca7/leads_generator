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
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1">
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
      <span className="whitespace-nowrap text-xs text-slate-400">
        {online.length} en línea
      </span>
      <div className="flex -space-x-1.5">
        {online.slice(0, 4).map((email) => (
          <span
            key={email}
            title={email + (email === userEmail ? " (tú)" : "")}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-900 bg-indigo-600 text-[10px] font-semibold uppercase text-white ring-1 ring-slate-700"
          >
            {email.slice(0, 2)}
          </span>
        ))}
        {online.length > 4 && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-900 bg-slate-700 text-[10px] font-semibold text-slate-200 ring-1 ring-slate-700">
            +{online.length - 4}
          </span>
        )}
      </div>
    </div>
  );
}
