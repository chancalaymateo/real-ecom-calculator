import { NextResponse } from "next/server";
import { CREATE_URL, getApiKey } from "../../clips/_kie";

export const runtime = "nodejs";

const DURATIONS = ["4", "6", "8", "10"];
const ASPECTS = ["16:9", "9:16"];
const RESOLUTIONS = ["720p", "1080p", "4k"];

// Crear tarea de video con el modelo gemini-omni-video (Kie.ai)
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
    audioIds = [],
    videoList = [],
    characterIds = [],
    duration = "8",
    aspect_ratio = "16:9",
    resolution = "720p",
    seed,
    callBackUrl,
  } = body || {};

  // ── Validaciones ──
  if (!prompt || !String(prompt).trim()) {
    return NextResponse.json({ error: "Falta el prompt." }, { status: 400 });
  }
  if (String(prompt).length > 20000) {
    return NextResponse.json({ error: "El prompt supera los 20.000 caracteres." }, { status: 400 });
  }

  const images = (imageUrls || []).filter(Boolean);
  const audios = (audioIds || []).map((s) => String(s).trim()).filter(Boolean);
  const chars = (characterIds || []).map((s) => String(s).trim()).filter(Boolean);
  const videos = (videoList || []).filter((v) => v && v.url);

  if (images.length > 7) return NextResponse.json({ error: "Máximo 7 imágenes." }, { status: 400 });
  if (audios.length > 3) return NextResponse.json({ error: "Máximo 3 audio IDs." }, { status: 400 });
  if (chars.length > 3) return NextResponse.json({ error: "Máximo 3 character IDs." }, { status: 400 });
  if (videos.length > 1) return NextResponse.json({ error: "Máximo 1 video." }, { status: 400 });

  // Cuota total: imágenes(1) + videos(2) + characterIds(1) ≤ 7
  const usedSlots = images.length + videos.length * 2 + chars.length;
  if (usedSlots > 7) {
    return NextResponse.json(
      {
        error: `Superás la cuota de 7 slots (usás ${usedSlots}). Imágenes=1, Video=2, Character ID=1 cada uno.`,
      },
      { status: 400 }
    );
  }

  if (!DURATIONS.includes(String(duration))) {
    return NextResponse.json({ error: "Duración inválida (4, 6, 8 o 10)." }, { status: 400 });
  }
  if (aspect_ratio && !ASPECTS.includes(aspect_ratio)) {
    return NextResponse.json({ error: "Aspect ratio inválido (16:9 o 9:16)." }, { status: 400 });
  }
  if (resolution && !RESOLUTIONS.includes(resolution)) {
    return NextResponse.json({ error: "Resolución inválida (720p, 1080p o 4k)." }, { status: 400 });
  }

  // Normalizar clips de video: start/ends numéricos, ends > start, diff ≤ 10s
  const cleanVideos = videos.map((v) => {
    const start = Number(v.start) || 0;
    let ends = Number(v.ends);
    if (!Number.isFinite(ends) || ends <= start) ends = start + 10;
    if (ends - start > 10) ends = start + 10;
    return { url: v.url, start, ends };
  });

  const input = {
    prompt: String(prompt),
    duration: String(duration),
  };
  if (images.length) input.image_urls = images;
  if (audios.length) input.audio_ids = audios;
  if (cleanVideos.length) input.video_list = cleanVideos;
  if (chars.length) input.character_ids = chars;
  if (aspect_ratio) input.aspect_ratio = aspect_ratio;
  if (resolution) input.resolution = resolution;
  if (seed !== undefined && seed !== null && seed !== "") {
    const s = Number(seed);
    if (Number.isInteger(s) && s >= 0 && s <= 2147483647) input.seed = s;
  }

  const payload = { model: "gemini-omni-video", input };
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
