import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cualquier usuario autenticado puede administrar usuarios. Devuelve el usuario o null.
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

const FORBIDDEN = NextResponse.json({ error: "No autorizado" }, { status: 403 });

// GET → lista de usuarios
export async function GET() {
  if (!(await requireUser())) return FORBIDDEN;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));
  return NextResponse.json({ users });
}

// POST → crear usuario { email, password }
export async function POST(req: Request) {
  if (!(await requireUser())) return FORBIDDEN;
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Correo válido y contraseña de 6+ caracteres requeridos." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH → resetear contraseña { id, password }
export async function PATCH(req: Request) {
  if (!(await requireUser())) return FORBIDDEN;
  const { id, password } = await req.json().catch(() => ({}));
  if (!id || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Id y contraseña de 6+ caracteres requeridos." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE → eliminar usuario ?id=...
export async function DELETE(req: Request) {
  const caller = await requireUser();
  if (!caller) return FORBIDDEN;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  if (id === caller.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
