import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const DEFAULT_SETTINGS = {
  id: "default",
  ml_fee_instante: 6.60,
  ml_fee_10dias:   4.60,
  ml_fee_18dias:   3.55,
  ml_fee_35dias:   1.56,
  ml_cuotas_2:     9.49,
  ml_cuotas_3:    12.19,
  iibb_pct:        2.00,
  commission_pct:  1.00,
  shipping_ars: 8100.00,
  mp_iva_pct:    21.00,
};

const DEFAULT_OFFERS = [
  { id: 1, name: "Oferta 1", quantity_label: "60 cápsulas",      sale_price: 49390,  product_cost: 6000,  cpa_be_target: 16.00, sort_order: 1 },
  { id: 2, name: "Oferta 2", quantity_label: "120 cápsulas",  sale_price: 59990,  product_cost: 12000, cpa_be_target: 17.30, sort_order: 2 },
  { id: 3, name: "Oferta 3", quantity_label: "180 cápsulas",  sale_price: 69990,  product_cost: 18000, cpa_be_target: 18.30, sort_order: 3 },
  { id: 4, name: "Oferta 4", quantity_label: "360 cápsulas",  sale_price: 109290, product_cost: 36000, cpa_be_target: 26.30, sort_order: 4 },
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
