import { NextResponse } from "next/server";
import { getApiKey } from "../../clips/_kie";

export const runtime = "nodejs";

// Veo 3.1 tiene su propio endpoint dedicado en Kie.ai (no usa la Jobs API genérica).
const CREATE_URL = process.env.KIE_VEO_CREATE_URL || "https://api.kie.ai/api/v1/veo/generate";

const MODELS = ["veo3", "veo3_fast", "veo3_lite"];
const DURATIONS = ["4", "6", "8"];
const ASPECTS = ["16:9", "9:16", "Auto"];
const RESOLUTIONS = ["720p", "1080p", "4k"];

// Crear tarea de video con Veo 3.1 (Kie.ai)
export async function POST(request) {
  const key = getApiKey(request);
  if (!key) {
    return NextResponse.json(
      { error: "Falta la API key. Cargala en la UI o en .env (KIE_API_KEY)." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const {
    prompt,
    imageUrls = [],
    model = "veo3_fast",
    duration = "8",
    aspect_ratio = "16:9",
    resolution = "720p",
    watermark,
    enableTranslation = false,
    callBackUrl,
  } = body || {};

  if (!prompt || !String(prompt).trim()) {
    return NextResponse.json({ error: "Falta el prompt." }, { status: 400 });
  }

  const images = (imageUrls || []).filter(Boolean);
  // No mandamos generationType: con 1 imagen Kie la toma como imagen única (no primer/último frame).
  if (images.length > 2) {
    return NextResponse.json({ error: "Máximo 2 imágenes (primer y último frame)." }, { status: 400 });
  }
  if (!MODELS.includes(model)) {
    return NextResponse.json({ error: "Modelo inválido (veo3, veo3_fast o veo3_lite)." }, { status: 400 });
  }
  if (!DURATIONS.includes(String(duration))) {
    return NextResponse.json({ error: "Duración inválida (4, 6 u 8)." }, { status: 400 });
  }
  if (aspect_ratio && !ASPECTS.includes(aspect_ratio)) {
    return NextResponse.json({ error: "Aspect ratio inválido (16:9, 9:16 o Auto)." }, { status: 400 });
  }
  if (resolution && !RESOLUTIONS.includes(resolution)) {
    return NextResponse.json({ error: "Resolución inválida (720p, 1080p o 4k)." }, { status: 400 });
  }

  const payload = {
    prompt: String(prompt),
    model,
    duration: Number(duration),
    aspect_ratio,
    resolution,
    enableTranslation: Boolean(enableTranslation),
  };
  if (images.length) payload.imageUrls = images;
  if (watermark && String(watermark).trim()) payload.watermark = String(watermark).trim();
  if (callBackUrl) payload.callBackUrl = callBackUrl;

  try {
    const r = await fetch(CREATE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    const taskId = data?.data?.taskId || data?.data?.task_id || data?.taskId;

    if (!r.ok || !taskId) {
      return NextResponse.json(
        {
          error: "Kie rechazó la tarea.",
          detail: data?.msg || data?.message || `HTTP ${r.status}`,
          raw: data,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ taskId });
  } catch (err) {
    return NextResponse.json({ error: "Error creando la tarea.", detail: String(err) }, { status: 500 });
  }
}
