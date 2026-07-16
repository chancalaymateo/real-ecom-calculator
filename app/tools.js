// ─── Registro central de herramientas del portal ────────────────
// Agregá acá una entrada nueva y aparece sola en la home del portal.
// icon: nombre de un icono de lucide-react.

export const TOOLS = [
  {
    slug: "calculadora",
    href: "/calculadora",
    title: "Calculadora de Rentabilidad",
    desc: "Calculá márgenes, CPA break-even y costos reales por oferta para MercadoPago y Tiendanube.",
    tag: "MercadoPago · Tiendanube",
    icon: "Calculator",
    ready: true,
  },
  {
    slug: "clips",
    href: "/clips",
    title: "Generador de Clips",
    desc: "Convertí hasta 7 imágenes en clips de video con IA (Grok Imagine / Kie.ai) desde tus guiones.",
    tag: "Grok · Kie.ai",
    icon: "Clapperboard",
    ready: true,
  },
  {
    slug: "gemini-video",
    href: "/gemini-video",
    title: "Gemini Omni Video",
    desc: "Generá videos con Gemini Omni: prompt + imágenes, video de origen, audio y character IDs.",
    tag: "Gemini · Kie.ai",
    icon: "Video",
    ready: true,
  },
];
