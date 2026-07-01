import { NextResponse } from "next/server";
import { getApiKey } from "../_kie";

export const runtime = "nodejs";

const CREDIT_URL = process.env.KIE_CREDIT_URL || "https://api.kie.ai/api/v1/chat/credit";

// Balance de créditos de la cuenta de Kie.ai
export async function GET(request) {
  const key = getApiKey(request);
  if (!key) {
    return NextResponse.json(
      { error: "Falta la API key. Cargala en la UI o en .env (KIE_API_KEY)." },
      { status: 400 }
    );
  }

  try {
    const r = await fetch(CREDIT_URL, { headers: { Authorization: `Bearer ${key}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(
        { error: "No se pudo leer el balance.", detail: data?.msg || data?.message || `HTTP ${r.status}` },
        { status: 502 }
      );
    }
    const credits =
      typeof data?.data === "number"
        ? data.data
        : data?.data?.credits ?? data?.credits ?? null;
    return NextResponse.json({ credits });
  } catch (err) {
    return NextResponse.json({ error: "Error consultando el balance.", detail: String(err) }, { status: 500 });
  }
}
