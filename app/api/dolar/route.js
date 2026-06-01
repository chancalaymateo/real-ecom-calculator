import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [blueRes, criptoRes] = await Promise.all([
      fetch("https://dolarapi.com/v1/dolares/blue",   { next: { revalidate: 180 } }),
      fetch("https://dolarapi.com/v1/dolares/cripto",  { next: { revalidate: 180 } }),
    ]);
    const [blue, cripto] = await Promise.all([blueRes.json(), criptoRes.json()]);
    return NextResponse.json({
      blue:   { compra: blue.compra,   venta: blue.venta },
      cripto: { compra: cripto.compra, venta: cripto.venta },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo obtener cotizaciones" }, { status: 500 });
  }
}
