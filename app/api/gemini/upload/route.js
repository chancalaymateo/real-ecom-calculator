import { NextResponse } from "next/server";
import { UPLOAD_URL, getApiKey } from "../../clips/_kie";

export const runtime = "nodejs";
export const maxDuration = 60;

// Subir imagen o video -> devuelve URL pública para usar en gemini-omni-video.
export async function POST(request) {
  const key = getApiKey(request);
  if (!key) {
    return NextResponse.json(
      { error: "Falta la API key. Cargala en la UI o en .env (KIE_API_KEY)." },
      { status: 400 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    const mimetype = file.type || "application/octet-stream";
    const isVideo = mimetype.startsWith("video/");
    const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: isVideo ? "El video supera los 100MB." : "La imagen supera los 20MB." },
        { status: 400 }
      );
    }

    const extRaw = mimetype.split("/")[1] || (isVideo ? "mp4" : "png");
    const ext = extRaw.replace("jpeg", "jpg").replace("quicktime", "mov");
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${mimetype};base64,${buffer.toString("base64")}`;
    const fileName = `${Date.now()}-${buffer.length}.${ext}`;
    const uploadPath = isVideo ? "videos/real-ecom-gemini" : "images/real-ecom-gemini";

    const r = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ base64Data: base64, uploadPath, fileName }),
    });

    const data = await r.json().catch(() => ({}));
    const url =
      data?.data?.downloadUrl ||
      data?.data?.url ||
      data?.data?.fileUrl ||
      data?.downloadUrl ||
      data?.url;

    if (!r.ok || !url) {
      return NextResponse.json(
        {
          error: isVideo ? "No se pudo subir el video a Kie." : "No se pudo subir la imagen a Kie.",
          detail: data?.msg || data?.message || `HTTP ${r.status}`,
          raw: data,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ url, kind: isVideo ? "video" : "image" });
  } catch (err) {
    return NextResponse.json({ error: "Error subiendo el archivo.", detail: String(err) }, { status: 500 });
  }
}
