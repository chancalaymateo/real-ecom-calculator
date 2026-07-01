// Config y helpers compartidos para el generador de clips (Kie.ai).

export const CREATE_URL = process.env.KIE_CREATE_URL || "https://api.kie.ai/api/v1/jobs/createTask";
export const RECORD_URL = process.env.KIE_RECORD_URL || "https://api.kie.ai/api/v1/jobs/recordInfo";
export const UPLOAD_URL = process.env.KIE_UPLOAD_URL || "https://kieai.redpandaai.co/api/file-base64-upload";

// La API key puede venir del header (UI) o del entorno del servidor.
export function getApiKey(request) {
  const fromHeader = request.headers.get("x-api-key");
  return (fromHeader && fromHeader.trim()) || process.env.KIE_API_KEY || "";
}
