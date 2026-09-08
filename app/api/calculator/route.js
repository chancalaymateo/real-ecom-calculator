import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const DEFAULT_SETTINGS = {
  id: "default",
  // Tasas MP netas (sin IVA). El calculo les aplica IVA 21% aparte.
  // VERIFICADO con liquidaciones reales de MP (sep-2026):
  //   al instante -> 3,9986% all-in  = 3,3046% + IVA
  //   3 cuotas    -> 12,6929% all-in = 10,49%  + IVA (adicional)
  //   2 cuotas    -> 9,4259% all-in  = 7,79%   + IVA (adicional)
  ml_fee_instante: 3.3046,
  // ESTIMADO: sin liquidacion que lo confirme. Escalados desde los valores
  // previos con el mismo ratio que corrigio "al instante" (x0,5007).
  ml_fee_10dias:   2.30,
  ml_fee_18dias:   1.78,
  ml_fee_35dias:   0.78,
  ml_cuotas_2:     7.79,
  ml_cuotas_3:    10.49,
  // IIBB: Santa Fe retiene 5% pero es pago a cuenta. El costo real computado
  // contra la DDJJ es ~2%; el 3% restante queda como saldo a favor.
  iibb_pct:        2.00,
  commission_pct:  0.60,   // Tienda Nube, verificado en export de ordenes
  shipping_ars: 9150.00,   // verificado en export de ordenes
  mp_iva_pct:    21.00,
  // % de ventas en cuotas, expresado en equivalente-3-cuotas: 57,3% salen en
  // 3 cuotas + las de 2 cuotas ponderadas por su costo relativo (7,79/10,49).
  cuotas_mix_pct:  59.00,
};

// Precios y costos verificados con el export de ordenes de Shopify (sep-2026).
// Costo de producto real: $6.800 por cada 60 capsulas.
// cuotas_mix = % de ventas en cuotas medido por oferta (equivalente-3-cuotas).
const DEFAULT_OFFERS = [
  { id: 1, name: "Oferta 1", quantity_label: "60 cápsulas",  sale_price: 49990,  product_cost: 6800,  cpa_be_target: 16.00, cuotas_mix: 42, sort_order: 1 },
  { id: 2, name: "Oferta 2", quantity_label: "120 cápsulas", sale_price: 59990,  product_cost: 13600, cpa_be_target: 17.30, cuotas_mix: 75, sort_order: 2 },
  { id: 3, name: "Oferta 3", quantity_label: "180 cápsulas", sale_price: 69990,  product_cost: 20400, cpa_be_target: 18.30, cuotas_mix: 82, sort_order: 3 },
  { id: 4, name: "Oferta 4", quantity_label: "360 cápsulas", sale_price: 109990, product_cost: 40800, cpa_be_target: 26.30, cuotas_mix: 100, sort_order: 4 },
];

// GET — datos públicos: settings + offers (con fallback a defaults si Supabase falla)
export async function GET() {
  try {
    const supabase = createServiceClient();
    const [settingsRes, offersRes] = await Promise.all([
      supabase.from("calc_settings").select("*").eq("id", "default").single(),
      supabase.from("calc_offers").select("*").order("sort_order"),
    ]);

    const settings = settingsRes.data ?? DEFAULT_SETTINGS;
    const offers   = (offersRes.data && offersRes.data.length > 0)
      ? offersRes.data
      : DEFAULT_OFFERS;

    return NextResponse.json({ settings, offers });
  } catch {
    // Si Supabase no responde, devuelve defaults hardcodeados
    return NextResponse.json({ settings: DEFAULT_SETTINGS, offers: DEFAULT_OFFERS });
  }
}

// PUT — escritura admin (requiere password en header)
export async function PUT(request) {
  const adminPassword = request.headers.get("x-admin-password");
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body    = await request.json();
    const supabase = createServiceClient();

    if (body.settings) {
      // Upsert en lugar de update, por si la fila default no existe
      const { error } = await supabase
        .from("calc_settings")
        .upsert({ ...body.settings, id: "default" });
      if (error) throw error;
    }

    if (body.offers && Array.isArray(body.offers)) {
      for (const offer of body.offers) {
        const { error } = await supabase
          .from("calc_offers")
          .upsert(offer);
        if (error) throw error;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
