// Pequeño cliente para hablar con las API routes del generador de clips.

function headers(apiKey, json = true) {
  const h = {};
  if (apiKey) h["x-api-key"] = apiKey;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function uploadImage(file, apiKey) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/clips/upload", {
    method: "POST",
    headers: headers(apiKey, false),
    body: fd,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || data.error || "Error subiendo la imagen");
  return data.url;
}

export async function createTask(body, apiKey) {
  const r = await fetch("/api/clips/generate", {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || data.error || "Error creando la tarea");
  return data.taskId;
}

export async function getStatus(taskId, apiKey) {
  const r = await fetch(`/api/clips/status/${encodeURIComponent(taskId)}`, {
    headers: headers(apiKey, false),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || data.error || "Error consultando estado");
  return data;
}

// Crea la tarea y hace polling hasta que termine.
export async function generateAndWait(body, apiKey, { onUpdate, interval = 6000, timeout = 900000 } = {}) {
  const taskId = await createTask(body, apiKey);
  onUpdate?.({ taskId, state: "processing" });

  const start = Date.now();
  while (Date.now() - start < timeout) {
    await new Promise((res) => setTimeout(res, interval));
    const s = await getStatus(taskId, apiKey);
    onUpdate?.({ taskId, ...s });
    if (s.state === "success") return { taskId, videoUrls: s.videoUrls };
    if (s.state === "fail") throw new Error(s.failMsg || "La generación falló");
  }
  throw new Error("Timeout esperando el video");
}
