import { NextResponse } from "next/server";
import { RECORD_URL, getApiKey } from "../../_kie";

export const runtime = "nodejs";

// Consultar estado de una tarea de video
export async function GET(request, { params }) {
  const key = getApiKey(request);
  if (!key) {
    return NextResponse.json(
      { error: "Falta la API key. Cargala en la UI o en .env (KIE_API_KEY)." },
      { status: 400 }
    );
  }

  try {
    const url = `${RECORD_URL}?taskId=${encodeURIComponent(params.taskId)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const data = await r.json().catch(() => ({}));
    const d = data?.data || {};

    // normalizamos el estado
    const rawState = String(d.state || d.status || "").toLowerCase();
    let state = "processing";
    if (["success", "succeed", "succeeded", "completed"].includes(rawState)) state = "success";
    else if (["fail", "failed", "error"].includes(rawState)) state = "fail";
    else if (["waiting", "queuing", "queued", "generating", "processing", "running", ""].includes(rawState))
      state = "processing";

    // sacamos las urls del resultado
    let videoUrls = [];
    if (d.resultJson) {
      try {
        const parsed = typeof d.resultJson === "string" ? JSON.parse(d.resultJson) : d.resultJson;
        videoUrls = parsed?.resultUrls || parsed?.urls || parsed?.videoUrls || [];
      } catch {}
    }
    if (!videoUrls.length && Array.isArray(d.resultUrls)) videoUrls = d.resultUrls;

    return NextResponse.json({
      state,
      rawState,
      videoUrls,
      failMsg: d.failMsg || d.failReason || d.errorMessage || "",
      raw: data,
    });
  } catch (err) {
    return NextResponse.json({ error: "Error consultando el estado.", detail: String(err) }, { status: 500 });
  }
}
