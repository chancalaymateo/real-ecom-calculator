import { NextResponse } from "next/server";
import { getApiKey } from "../../../clips/_kie";

export const runtime = "nodejs";

const RECORD_URL = process.env.KIE_VEO_RECORD_URL || "https://api.kie.ai/api/v1/veo/record-info";

// Consultar estado de una tarea de Veo 3.1
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

    // Veo devuelve successFlag (0=generando, 1=éxito, 2/3=fallo) además de un state genérico.
    const flag = d.successFlag ?? d.success_flag;
    const rawState = String(d.state || d.status || (flag != null ? `flag:${flag}` : "")).toLowerCase();

    let state = "processing";
    if (flag === 1 || ["success", "succeed", "succeeded", "completed"].includes(rawState)) state = "success";
    else if ((typeof flag === "number" && flag >= 2) || ["fail", "failed", "error"].includes(rawState))
      state = "fail";

    let videoUrls = d?.response?.resultUrls || d?.resultUrls || d?.result?.resultUrls || [];
    if (!videoUrls.length && d.resultJson) {
      try {
        const parsed = typeof d.resultJson === "string" ? JSON.parse(d.resultJson) : d.resultJson;
        videoUrls = parsed?.resultUrls || parsed?.urls || parsed?.videoUrls || [];
      } catch {}
    }

    return NextResponse.json({
      state,
      rawState,
      videoUrls,
      failMsg: d.failMsg || d.errorMessage || d.failReason || "",
      raw: data,
    });
  } catch (err) {
    return NextResponse.json({ error: "Error consultando el estado.", detail: String(err) }, { status: 500 });
  }
}
