// Bloque de referencia comun a todas las escenas (misma cara, pose y encuadre).
const REFERENCE =
  'Usá la imagen de referencia, misma cara y pose exacta. Selfie con brazo extendido, ' +
  'doctora en consultorio, ambo blanco con nombre bordado "Dra. Vanesa Garrán", ' +
  "sosteniendo el frasco chico de Celuvit con la otra mano cerca de la cara mostrándolo, " +
  "diplomas de fondo, estantería con productos cosméticos. Que mantenga el celular firme en la mano " +
  "sin soltarlo ni bajar el brazo. Que mantenga el frasco firme sin soltarlo ni moverlo, " +
  "solo movimientos naturales de cara y expresión. Respetá la etiqueta de Celuvit idéntica a la imagen de referencia.";

const VOICE =
  "Voz femenina argentina rioplatense de Buenos Aires, acento porteño con sonido sh en ll e y,";

function build(tono, dialogo) {
  return `${REFERENCE} ${VOICE} ${tono} Lip sync perfecto.\n\nElla dice esto: ${dialogo}`;
}

export const SCENES = [
  {
    id: 1,
    title: "Escena 1",
    duration: 9,
    prompt: build(
      "tono directo y didáctico, como presentando algo que conoce a fondo. Lo dice mirando a cámara, con energía contenida, como quien está a punto de explicar algo que pocas personas saben.",
      "Esto que tengo en la mano tiene los 8 ingredientes más estudiados para reactivar la circulación y reducir la celulitis. Te muestro qué le hace a tu cuerpo."
    ),
  },
  {
    id: 2,
    title: "Escena 2",
    duration: 9,
    prompt: build(
      "tono técnico y pausado, como explicando un proceso clínico paso a paso. Lo dice con cadencia, dando tiempo a cada etapa del recorrido de la cápsula en el cuerpo.",
      "La tragás, llega al estómago y en 30 minutos pasa al torrente sanguíneo. Viaja directo a las venas y al sistema linfático, donde se reactiva la microcirculación."
    ),
  },
  {
    id: 3,
    title: "Escena 3",
    duration: 7,
    prompt: build(
      "tono didáctico y simple, usando una analogía cotidiana. Lo dice como quien encuentra la metáfora perfecta para que cualquiera lo entienda.",
      "Pensalo como las cañerías de tu cuerpo, cuando se enlentecen, el líquido se queda estancado y ahí aparece la celulitis."
    ),
  },
  {
    id: 4,
    title: "Escena 4",
    duration: 11,
    prompt: build(
      'tono técnico y resolutivo, enumerando con convicción. Lo dice con golpe seco en "Menos hinchazón, piernas más livianas, piel más pareja", como cerrando el efecto con tres resultados concretos.',
      "La Centesha Asiática activa esa circulación directamente y le ordena al cuerpo drenar en lugar de retener. La Diosmina y el Ginkgo Biloba refuerzan ese efecto. Menos hinchazón, piernas más livianas, piel más pareja."
    ),
  },
  {
    id: 5,
    title: "Escena 5",
    duration: 9,
    prompt: build(
      'tono que empieza con entusiasmo en "Y bonus" y vuelve a técnico al explicar el Té Verde. Lo dice como agregando un dato extra que la misma sorprende un poco.',
      "Y bonus, también ataca la inflamación subcutánea. El Té Verde la reduce, y eso corta lo que le da a la piel esa textura de naranja."
    ),
  },
  {
    id: 6,
    title: "Escena 6",
    duration: 10,
    prompt: build(
      'tono directo y con un toque irónico en "la pizca que ponen las cremas genéricas". Lo dice cerrando el argumento con autoridad y dejando el dato práctico al final sin presión.',
      "¿Por qué en cápsula? Porque la dosis justa son los 8 ingredientes completos, no la pizca que ponen las cremas genéricas. ¿Una cápsula? Sí. Envío gratis a todo el país."
    ),
  },
];

// Texto de ejemplo con voz (todo el guión) para el cuadro de pegado.
export const SAMPLE_SCRIPT = SCENES.map(
  (s) => `Escena ${s.id} — Imagen 1 — ${s.duration} segundos\n${s.prompt}`
).join("\n\n");

// Ejemplo de "clips" (solo movimiento, sin voz ni diálogo).
export const SAMPLE_CLIPS = [
  {
    imagen: 1,
    duration: 8,
    prompt:
      "Usá la imagen de referencia, mismo encuadre exacto. Cámara fija. La mano sostiene el frasco de Celuvit y lo rota levemente de un lado al otro, movimiento suave y continuo, como mostrando el frasco desde un ángulo ligeramente diferente y volviendo a la posición original. El movimiento es sutil, no exagerado, como si la persona lo estuviera girando apenas para mostrar la etiqueta. La mano se mantiene firme, solo el frasco rota levemente. Respetá la etiqueta de Celuvit idéntica a la imagen de referencia. Sin diálogo. Sin voz. 9:16 vertical.",
  },
  {
    imagen: 2,
    duration: 8,
    prompt:
      "Usá la imagen de referencia, mismo encuadre exacto. Cámara fija. Movimientos naturales y sutiles, sin cambiar la pose ni el encuadre. Mantené el producto firme y bien visible, con la etiqueta idéntica a la imagen de referencia. Sin diálogo. Sin voz. 9:16 vertical.",
  },
].map((c, i) => `Clip ${i + 1} — Imagen ${c.imagen} — ${c.duration} segundos\n${c.prompt}`).join("\n\n");

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
