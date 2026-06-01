-- ============================================================
-- CALCULADORA ML — Schema (idempotente)
-- Ejecutar en: Supabase → SQL Editor → Run
-- ============================================================

-- ============================================================
-- TABLA: Configuración global (admin la setea, usuario lee)
-- ============================================================
create table if not exists calc_settings (
  id text primary key default 'default',
  -- Comisiones MP por plazo de acreditación
  ml_fee_instante  numeric(5,2) not null default 6.60,
  ml_fee_10dias    numeric(5,2) not null default 4.60,
  ml_fee_18dias    numeric(5,2) not null default 3.55,
  ml_fee_35dias    numeric(5,2) not null default 1.56,
  -- Adicionales por cuotas sin interés (hasta 3)
  ml_cuotas_2      numeric(5,2) not null default 9.49,
  ml_cuotas_3      numeric(5,2) not null default 12.19,
  -- IVA sobre comisiones MP
  mp_iva_pct       numeric(5,2) not null default 21.00,
  -- Otros costos
  iibb_pct         numeric(5,2) not null default 2.00,
  commission_pct   numeric(5,2) not null default 1.00,
  shipping_ars     numeric(12,2) not null default 8100.00,
  updated_at       timestamptz  not null default now()
);

-- Agregar columna si no existe (idempotente para bases ya creadas)
alter table calc_settings add column if not exists mp_iva_pct numeric(5,2) not null default 21.00;

-- Asegurar fila default
insert into calc_settings (id) values ('default')
on conflict (id) do nothing;

-- ============================================================
-- TABLA: Las 4 ofertas
-- ============================================================
create table if not exists calc_offers (
  id             integer primary key,
  name           text        not null,
  quantity_label text        not null,
  sale_price     numeric(12,2) not null default 0,
  product_cost   numeric(12,2) not null default 0,
  cpa_be_target  numeric(10,2) not null default 0,
  sort_order     integer     not null,
  updated_at     timestamptz not null default now()
);

-- Datos default de las 4 ofertas
insert into calc_offers (id, name, quantity_label, sale_price, product_cost, cpa_be_target, sort_order)
values
  (1, 'Oferta 1', '1 unidad',      49390.00,  6000.00,  16.00, 1),
  (2, 'Oferta 2', '120 cápsulas',  59990.00,  12000.00, 17.30, 2),
  (3, 'Oferta 3', '180 cápsulas',  69990.00,  18000.00, 18.30, 3),
  (4, 'Oferta 4', '360 cápsulas',  109290.00, 36000.00, 26.30, 4)
on conflict (id) do nothing;

-- ============================================================
-- TABLA: Usuarios de la calculadora
-- ============================================================
create table if not exists calc_users (
  id             uuid primary key default gen_random_uuid(),
  username       text not null,
  username_lower text not null unique,
  password_hash  text not null,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- TABLA: Sesiones de usuario
-- ============================================================
create table if not exists calc_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references calc_users(id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TABLA: Configuración guardada por usuario
-- ============================================================
create table if not exists calc_user_configs (
  user_id    uuid primary key references calc_users(id) on delete cascade,
  config     jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RLS — lectura pública para settings/offers, escritura solo service role
--       users/sessions/user_configs: solo service role (sin políticas abiertas)
-- ============================================================
alter table calc_settings    enable row level security;
alter table calc_offers      enable row level security;
alter table calc_users       enable row level security;
alter table calc_sessions    enable row level security;
alter table calc_user_configs enable row level security;

drop policy if exists "calc_settings_read" on calc_settings;
create policy "calc_settings_read" on calc_settings
  for select using (true);

drop policy if exists "calc_offers_read" on calc_offers;
create policy "calc_offers_read" on calc_offers
  for select using (true);

-- ============================================================
-- Trigger updated_at
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists calc_settings_updated_at on calc_settings;
create trigger calc_settings_updated_at
  before update on calc_settings
  for each row execute function set_updated_at();

drop trigger if exists calc_offers_updated_at on calc_offers;
create trigger calc_offers_updated_at
  before update on calc_offers
  for each row execute function set_updated_at();

drop trigger if exists calc_user_configs_updated_at on calc_user_configs;
create trigger calc_user_configs_updated_at
  before update on calc_user_configs
  for each row execute function set_updated_at();
