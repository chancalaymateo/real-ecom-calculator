import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

async function validateSession(request) {
  const userId = request.headers.get("x-user-id");
  const token  = request.headers.get("x-auth-token");
  if (!userId || !token) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("calc_sessions")
    .select("user_id, expires_at")
    .eq("user_id", userId)
    .eq("token", token)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return userId;
}

export async function GET(request) {
  const userId = await validateSession(request);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("calc_user_configs")
      .select("config")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({ config: data?.config ?? null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const userId = await validateSession(request);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { config } = await request.json();
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("calc_user_configs")
      .upsert({ user_id: userId, config, updated_at: new Date().toISOString() });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
