-- ============================================================
-- Borrar tablas del sistema anterior (ONYRO multi-tienda)
-- Ejecutar en: Supabase → SQL Editor → Run
-- ⚠️  IRREVERSIBLE — solo ejecutar si ya no necesitás esos datos
-- ============================================================

-- Borrar en orden para respetar FK
drop table if exists tn_sync_log         cascade;
drop table if exists movimientos_socios  cascade;
drop table if exists ventas              cascade;
drop table if exists gastos_fijos_override cascade;
drop table if exists gastos_fijos        cascade;
drop table if exists gastos_diarios      cascade;
drop table if exists documentos          cascade;
drop table if exists producto_materiales cascade;
drop table if exists productos           cascade;
drop table if exists materiales          cascade;
drop table if exists store_config        cascade;
drop table if exists store_members       cascade;
drop table if exists stores              cascade;

-- Confirmar lo que queda (deben ser solo las 2 nuevas)
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;
