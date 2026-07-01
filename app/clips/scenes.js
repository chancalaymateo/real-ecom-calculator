// Separa un guión pegado en escenas o clips.
// Reconoce encabezados tipo:
//   "Escena 1 — Imagen 1 — 9 segundos"   (con voz)
//   "Clip — Imagen 1 — 8 segundos"       (solo movimiento; el número es opcional)
// Acepta guiones —, – o -. Todo lo que sigue hasta el próximo encabezado
// es el prompt de ese bloque.
export function parseScript(text) {
  const headerRe =
    /(Escena|Clip)\s*(\d+)?\s*[—–-]\s*Imagen\s+(\d+)\s*[—–-]\s*(\d+)\s*segundos[^\n]*/gi;
  const matches = [...(text || "").matchAll(headerRe)];
  if (!matches.length) return [];

  return matches.map((m, i) => {
    const keyword = /clip/i.test(m[1]) ? "Clip" : "Escena";
    const num = Number(m[2]) || i + 1;
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    return {
      id: i + 1,
      title: `${keyword} ${num}`,
      imageIndex: Math.max(0, (Number(m[3]) || 1) - 1),
      duration: Number(m[4]) || 9,
      prompt: text.slice(start, end).trim(),
    };
  });
}
