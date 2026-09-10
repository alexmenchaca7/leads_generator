import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Genera el archivo de conexión ya configurado para el worker. Solo usuarios con
// sesión. Las llaves viven en el servidor (env vars); aquí se entregan como
// archivo descargable para que el usuario no tenga que escribirlas a mano.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    return NextResponse.json(
      { error: "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 500 }
    );
  }

  const body =
    "# Archivo de conexión del motor de búsquedas.\n" +
    "# Colócalo en la carpeta del programa (mismo lugar que start_worker.bat).\n" +
    `SUPABASE_URL=${url}\n` +
    `SUPABASE_SERVICE_KEY=${key}\n`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="conexion.env"',
      "Cache-Control": "no-store",
    },
  });
}
