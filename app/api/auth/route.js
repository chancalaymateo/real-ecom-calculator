import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

function hashPassword(pass) {
  return createHash("sha256").update(pass).digest("hex");
}

export async function POST(request) {
  try {
    const { action, username, password } = await request.json();

    if (!username?.trim() || !password) {
      return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const user_lower = username.trim().toLowerCase();
    const hashed = hashPassword(password);

    if (action === "register") {
      // Check if username taken
      const { data: existing } = await supabase
        .from("calc_users")
        .select("id")
        .eq("username_lower", user_lower)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: "Ese usuario ya existe" }, { status: 409 });
      }

      const { data: newUser, error: insertErr } = await supabase
        .from("calc_users")
        .insert({ username: username.trim(), username_lower: user_lower, password_hash: hashed })
        .select("id, username")
        .single();

      if (insertErr) throw insertErr;

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("calc_sessions").insert({ user_id: newUser.id, token, expires_at: expiresAt });

      return NextResponse.json({ userId: newUser.id, username: newUser.username, token });
    }

    if (action === "login") {
      const { data: found } = await supabase
        .from("calc_users")
        .select("id, username, password_hash")
        .eq("username_lower", user_lower)
        .maybeSingle();

      if (!found || found.password_hash !== hashed) {
        return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
      }

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("calc_sessions").insert({ user_id: found.id, token, expires_at: expiresAt });

      return NextResponse.json({ userId: found.id, username: found.username, token });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
