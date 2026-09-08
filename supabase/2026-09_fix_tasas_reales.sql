-- ============================================================
-- MIGRACIÓN — Tasas reales verificadas contra liquidaciones MP
-- y export de órdenes de Shopify (sep-2026).
-- Ejecutar en: Supabase → SQL Editor → Run
--
-- IMPORTANTE: la app lee calc_settings/calc_offers de Supabase y
-- sólo usa los defaults del código si la consulta falla. Sin correr
-- esto, la calculadora sigue mostrando los valores viejos.
-- ============================================================

-- 1) numeric(5,2) truncaba las tasas a 2 decimales (3,3046 -> 3,30).
alter table calc_settings alter column ml_fee_instante type numeric(7,4);
alter table calc_settings alter column ml_fee_10dias   type numeric(7,4);
alter table calc_settings alter column ml_fee_18dias   type numeric(7,4);
alter table calc_settings alter column ml_fee_35dias   type numeric(7,4);
alter table calc_settings alter column ml_cuotas_2     type numeric(7,4);
alter table calc_settings alter column ml_cuotas_3     type numeric(7,4);

-- 2) Mix de ventas en cuotas sin interés (real medido: 57,3%).
-- Expresado en equivalente-3-cuotas: 57,3% de las ventas salen en 3 cuotas,
-- mas las de 2 cuotas ponderadas por su costo relativo (7,79 / 10,49 = 0,74).
alter table calc_settings add column if not exists cuotas_mix_pct numeric(5,2) not null default 59.00;
-- Mix medido por oferta; null = hereda el global.
alter table calc_offers   add column if not exists cuotas_mix     numeric(5,2);

-- 3) Tasas MP netas (sin IVA); el cálculo les suma IVA 21% aparte.
--    Verificado sobre liquidaciones reales:
--      al instante -> 3,9986% all-in  = 3,3046 + IVA
--      3 cuotas    -> 12,6929% all-in = 10,49  + IVA (adicional)
--      2 cuotas    ->  9,4259% all-in =  7,79  + IVA (adicional)
--    Los plazos 10/18/35 días NO están verificados: escalados desde los
--    valores anteriores con el mismo ratio que corrigió "al instante".
update calc_settings set
  ml_fee_instante = 3.3046,
  ml_fee_10dias   = 2.3000,
  ml_fee_18dias   = 1.7800,
  ml_fee_35dias   = 0.7800,
  ml_cuotas_2     = 7.7900,
  ml_cuotas_3     = 10.4900,
  iibb_pct        = 2.00,      -- Santa Fe retiene 5%, pero es pago a cuenta
  commission_pct  = 0.60,      -- Tienda Nube
  shipping_ars    = 9150.00,
  cuotas_mix_pct  = 59.00,
  updated_at      = now()
where id = 'default';

-- 4) Precios y costos reales. Costo de producto: $6.800 por cada 60 cápsulas.
update calc_offers set sale_price =  49990.00, product_cost =  6800.00, cuotas_mix =  42, updated_at = now() where id = 1;
update calc_offers set sale_price =  59990.00, product_cost = 13600.00, cuotas_mix =  75, updated_at = now() where id = 2;
update calc_offers set sale_price =  69990.00, product_cost = 20400.00, cuotas_mix =  82, updated_at = now() where id = 3;
update calc_offers set sale_price = 109990.00, product_cost = 40800.00, cuotas_mix = 100, updated_at = now() where id = 4;

-- Verificación
select ml_fee_instante, ml_cuotas_2, ml_cuotas_3, iibb_pct, commission_pct, shipping_ars, cuotas_mix_pct from calc_settings where id = 'default';
select id, quantity_label, sale_price, product_cost, cuotas_mix from calc_offers order by sort_order;
