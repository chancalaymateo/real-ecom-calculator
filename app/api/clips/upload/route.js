import { NextResponse } from "next/server";
import { UPLOAD_URL, getApiKey } from "../_kie";

export const runtime = "nodejs";

// Subir imagen -> devuelve URL publica (file.aiquickdraw.com)
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
      return NextResponse.json({ error: "No se recibio ninguna imagen." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "La imagen supera los 10MB permitidos por Kie." }, { status: 400 });
    }

    const mimetype = file.type || "image/png";
    const ext = (mimetype.split("/")[1] || "png").replace("jpeg", "jpg");
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${mimetype};base64,${buffer.toString("base64")}`;
    const fileName = `${Date.now()}-${buffer.length}.${ext}`;

    const r = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        base64Data: base64,
        uploadPath: "images/real-ecom-clips",
        fileName,
      }),
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
    return NextResponse.json({ error: "Error subiendo la imagen.", detail: String(err) }, { status: 500 });
  }
}
