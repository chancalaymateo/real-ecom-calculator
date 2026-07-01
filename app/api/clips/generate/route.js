import { NextResponse } from "next/server";
import { CREATE_URL, getApiKey } from "../_kie";

export const runtime = "nodejs";

// Crear tarea de video en Kie.ai
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
    imageUrl,
    imageUrls,
    prompt,
    duration = "9",
    mode = "normal",
    resolution = "720p",
    aspect_ratio = "9:16",
    nsfw_checker = true,
    callBackUrl,
  } = body || {};

  const urls = imageUrls?.length ? imageUrls : imageUrl ? [imageUrl] : [];
  if (!urls.length) return NextResponse.json({ error: "Falta la URL de la imagen." }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Falta el prompt." }, { status: 400 });

  const payload = {
    model: "grok-imagine/image-to-video",
    input: {
      image_urls: urls,
      prompt,
      duration: String(duration),
      mode,
      resolution,
      aspect_ratio,
      nsfw_checker: Boolean(nsfw_checker),
    },
  };
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
          error: "Kie rechazo la tarea.",
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
