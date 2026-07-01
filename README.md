# Real Ecom Academy — Portal de herramientas

App web única (Next.js 14) que agrupa las herramientas y automatizaciones de
Real Ecom Academy. Desde la home elegís qué herramienta usar.

## Herramientas

| Ruta | Herramienta | Descripción |
|------|-------------|-------------|
| `/` | **Portal** | Home con las tarjetas de acceso a cada herramienta. |
| `/calculadora` | **Calculadora de Rentabilidad** | Márgenes, CPA break-even y costos reales (MercadoPago / Tiendanube). |
| `/clips` | **Generador de Clips** | Convierte 1–3 imágenes en clips de video con IA (Grok Imagine / Kie.ai). |

Para agregar una herramienta nueva a la home, sumá una entrada en
[`app/tools.js`](app/tools.js) — aparece sola en el portal.

## Correr en local

```bash
npm install
cp .env.example .env.local   # completá las variables
npm run dev                  # http://localhost:3000
```

## Variables de entorno

Ver [`.env.example`](.env.example). Resumen:

- **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) — usados por la calculadora (login, config).
- **`ADMIN_PASSWORD`** — panel de admin de la calculadora.
- **`KIE_API_KEY`** — opcional para el Generador de Clips. Si la dejás vacía,
  cada usuario pega su propia key desde la UI (se guarda sólo en su navegador).

## Deploy en Vercel

Es una app Next.js estándar: importá el repo en Vercel, cargá las variables de
entorno y deploy. El backend del generador de clips vive en API routes
(`app/api/clips/*`) que corren como funciones serverless — no hace falta un
servidor Express aparte. El polling del estado del video lo hace el navegador,
así que las funciones responden rápido (sin timeouts largos).
