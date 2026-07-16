import { NextResponse } from "next/server";
import { UPLOAD_URL, getApiKey } from "../../clips/_kie";

export const runtime = "nodejs";
export const maxDuration = 60;

// Subir imagen -> devuelve URL pública para usar en Veo 3.1.
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
    const mimetype = file.type || "image/png";
    if (!mimetype.startsWith("image/")) {
      return NextResponse.json({ error: "Solo se aceptan imágenes (JPG, JPEG o PNG)." }, { status: 400 });
    }

    const maxBytes = 10 * 1024 * 1024; // Veo acepta hasta 10MB por imagen
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "La imagen supera los 10MB." }, { status: 400 });
    }

    const ext = mimetype.split("/")[1]?.replace("jpeg", "jpg") || "png";
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${mimetype};base64,${buffer.toString("base64")}`;
    const fileName = `${Date.now()}-${buffer.length}.${ext}`;

    const r = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ base64Data: base64, uploadPath: "images/real-ecom-veo", fileName }),
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
          error: "No se pudo subir la imagen a Kie.",
          detail: data?.msg || data?.message || `HTTP ${r.status}`,
          raw: data,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: "Error subiendo el archivo.", detail: String(err) }, { status: 500 });
  }
}
