-- ============================================================
-- VISTANUBE — Instalación completa (idempotente)
-- Funciona tanto en base de datos nueva como existente.
-- Ejecutar en: Supabase → SQL Editor → Run
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLAS
-- ============================================================

create table if not exists stores (
  id         uuid primary key default uuid_generate_v4(),
  nombre     text not null,
  slug       text unique not null,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Roles: owner | member (socio) | contador (solo lectura financiera)
create table if not exists store_members (
  store_id   uuid not null references stores(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member',
  invited_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

-- Actualizar constraint de role (por si ya existía con menos valores)
alter table store_members drop constraint if exists store_members_role_check;
alter table store_members add constraint store_members_role_check
  check (role in ('owner', 'member', 'contador'));

create table if not exists store_config (
  store_id   uuid not null references stores(id) on delete cascade,
  clave      text not null,
  valor      text,
  updated_at timestamptz not null default now(),
  primary key (store_id, clave)
);

create table if not exists materiales (
  id                uuid primary key default uuid_generate_v4(),
  store_id          uuid not null references stores(id) on delete cascade,
  nombre            text not null,
  proveedor         text,
  precio_pack       numeric(12,2) not null default 0,
  cantidad_pack     numeric(12,4) not null default 1,
  tiene_factura_iva boolean not null default false,
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists productos (
  id             uuid primary key default uuid_generate_v4(),
  store_id       uuid not null references stores(id) on delete cascade,
  nombre         text not null,
  descripcion    text,
  sku_tiendanube text,
  imagen_url     text,
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists producto_materiales (
  id             uuid primary key default uuid_generate_v4(),
  producto_id    uuid not null references productos(id) on delete cascade,
  material_id    uuid not null references materiales(id) on delete restrict,
  cantidad_usada numeric(12,4) not null default 1,
  unique (producto_id, material_id)
);

create table if not exists ventas (
  id                 uuid primary key default uuid_generate_v4(),
  store_id           uuid not null references stores(id) on delete cascade,
  numero_orden       text,
  fecha              date not null,
  producto_id        uuid references productos(id) on delete set null,
  producto_nombre_tn text,
  unidades           integer not null default 1,
  pv_cobrado         numeric(12,2) not null default 0,
  forma_pago         text not null default 'Transferencia',
  plazo_mp           text,
  cuotas             integer not null default 1,
  devolucion         numeric(12,2) not null default 0,
  env_prioritario    boolean not null default false,
  costo_mercaderia   numeric(12,2) not null default 0,
  comision_mp        numeric(12,2) not null default 0,
  comision_tn        numeric(12,2) not null default 0,
  iva_comisiones     numeric(12,2) not null default 0,
  iibb               numeric(12,2) not null default 0,
  ganancia_neta      numeric(12,2) not null default 0,
  origen             text not null default 'manual' check (origen in ('tiendanube', 'manual')),
  tn_raw_data        jsonb,
  notas              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists ventas_store_fecha on ventas(store_id, fecha);

-- Eliminar constraint viejo si existe (el sync usa delete+insert, no necesita unique)
alter table ventas drop constraint if exists ventas_store_orden_unique;

create table if not exists gastos_diarios (
  id           uuid primary key default uuid_generate_v4(),
  store_id     uuid not null references stores(id) on delete cascade,
  fecha        date not null,
  ads_usd      numeric(12,2) not null default 0,
  tc_dia       numeric(10,4) not null default 1,
  ads_ars      numeric(12,2) generated always as (ads_usd * tc_dia) stored,
  andreani_ars numeric(12,2) not null default 0,
  total_dia    numeric(12,2) generated always as (ads_usd * tc_dia + andreani_ars) stored,
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, fecha)
);

create table if not exists gastos_fijos (
  id                uuid primary key default uuid_generate_v4(),
  store_id          uuid not null references stores(id) on delete cascade,
  concepto          text not null,
  monto             numeric(12,2) not null default 0,
  tiene_factura_iva boolean not null default false,
  activo            boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists gastos_fijos_override (
  id             uuid primary key default uuid_generate_v4(),
  gasto_fijo_id  uuid not null references gastos_fijos(id) on delete cascade,
  anio           integer not null,
  mes            integer not null check (mes between 1 and 12),
  monto_override numeric(12,2) not null,
  unique (gasto_fijo_id, anio, mes)
);

create table if not exists movimientos_socios (
  id           uuid primary key default uuid_generate_v4(),
  store_id     uuid not null references stores(id) on delete cascade,
  fecha        date not null,
  socio_nombre text not null,
  tipo         text not null check (tipo in ('aporte', 'retiro', 'gasto_socio', 'pago_desde_mp', 'cobro_a_mp')),
  concepto     text,
  monto        numeric(12,2) not null,
  notas        text,
  created_at   timestamptz not null default now()
);

create table if not exists tn_sync_log (
  id                 uuid primary key default uuid_generate_v4(),
  store_id           uuid not null references stores(id) on delete cascade,
  tipo               text not null,
  estado             text not null check (estado in ('ok', 'error', 'parcial')),
  ordenes_procesadas integer not null default 0,
  error              text,
  created_at         timestamptz not null default now()
);

-- ============================================================
-- FUNCIONES HELPER
-- ============================================================

create or replace function public.user_has_store_access(p_store_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from store_members
    where store_id = p_store_id and user_id = auth.uid()
  );
$$;

create or replace function public.user_is_store_owner(p_store_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from store_members
    where store_id = p_store_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.user_is_owner_or_member(p_store_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from store_members
    where store_id = p_store_id and user_id = auth.uid() and role in ('owner', 'member')
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table stores                enable row level security;
alter table store_members         enable row level security;
alter table store_config          enable row level security;
alter table materiales            enable row level security;
alter table productos             enable row level security;
alter table producto_materiales   enable row level security;
alter table ventas                enable row level security;
alter table gastos_diarios        enable row level security;
alter table gastos_fijos          enable row level security;
alter table gastos_fijos_override enable row level security;
alter table movimientos_socios    enable row level security;
alter table tn_sync_log           enable row level security;

-- Borrar políticas viejas (por si ya existían)
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('stores','store_members','store_config','materiales',
                               'productos','producto_materiales','ventas','gastos_diarios',
                               'gastos_fijos','gastos_fijos_override','movimientos_socios','tn_sync_log')
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- stores
create policy "stores_select" on stores
  for select using (user_has_store_access(id));
create policy "stores_insert" on stores
  for insert with check (owner_id = auth.uid());
create policy "stores_update" on stores
  for update using (user_is_store_owner(id));

-- store_members
create policy "members_select" on store_members
  for select using (user_has_store_access(store_id));
create policy "members_all_owner" on store_members
  for all using (user_is_store_owner(store_id));

-- store_config — solo owner (tiene tokens de API)
create policy "config_all_owner" on store_config
  for all using (user_is_store_owner(store_id));

-- materiales — owner + socio
create policy "materiales_select" on materiales
  for select using (user_is_owner_or_member(store_id));
create policy "materiales_all" on materiales
  for all using (user_is_owner_or_member(store_id));

-- productos — owner + socio
create policy "productos_select" on productos
  for select using (user_is_owner_or_member(store_id));
create policy "productos_all" on productos
  for all using (user_is_owner_or_member(store_id));

-- producto_materiales — owner + socio
create policy "pm_select" on producto_materiales
  for select using (
    exists (select 1 from productos p where p.id = producto_id and user_is_owner_or_member(p.store_id))
  );
create policy "pm_all" on producto_materiales
  for all using (
    exists (select 1 from productos p where p.id = producto_id and user_is_owner_or_member(p.store_id))
  );

-- ventas — todos leen; owner + socio escriben
create policy "ventas_select" on ventas
  for select using (user_has_store_access(store_id));
create policy "ventas_insert" on ventas
  for insert with check (user_is_owner_or_member(store_id));
create policy "ventas_update" on ventas
  for update using (user_is_owner_or_member(store_id));
create policy "ventas_delete" on ventas
  for delete using (user_is_owner_or_member(store_id));

-- gastos_diarios — todos leen; owner + socio escriben
create policy "gastos_diarios_select" on gastos_diarios
  for select using (user_has_store_access(store_id));
create policy "gastos_diarios_write" on gastos_diarios
  for all using (user_is_owner_or_member(store_id));

-- gastos_fijos — todos leen; owner + socio escriben
create policy "gastos_fijos_select" on gastos_fijos
  for select using (user_has_store_access(store_id));
create policy "gastos_fijos_write" on gastos_fijos
  for all using (user_is_owner_or_member(store_id));

-- gastos_fijos_override
create policy "gfo_select" on gastos_fijos_override
  for select using (
    exists (select 1 from gastos_fijos gf where gf.id = gasto_fijo_id and user_has_store_access(gf.store_id))
  );
create policy "gfo_write" on gastos_fijos_override
  for all using (
    exists (select 1 from gastos_fijos gf where gf.id = gasto_fijo_id and user_is_owner_or_member(gf.store_id))
  );

-- movimientos_socios — owner + socio
create policy "socios_select" on movimientos_socios
  for select using (user_is_owner_or_member(store_id));
create policy "socios_all" on movimientos_socios
  for all using (user_is_owner_or_member(store_id));

-- tn_sync_log — owner + socio
create policy "sync_log_select" on tn_sync_log
  for select using (user_is_owner_or_member(store_id));
create policy "sync_log_insert" on tn_sync_log
  for insert with check (user_is_owner_or_member(store_id));

-- ============================================================
-- TRIGGER: auto-agregar owner a store_members al crear tienda
-- ============================================================

create or replace function public.handle_new_store()
returns trigger language plpgsql security definer as $$
begin
  insert into store_members (store_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (store_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_store_created on stores;
create trigger on_store_created
  after insert on stores
  for each row execute procedure public.handle_new_store();

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_updated_at_materiales    on materiales;
drop trigger if exists trg_updated_at_productos     on productos;
drop trigger if exists trg_updated_at_ventas        on ventas;
drop trigger if exists trg_updated_at_gastos_diarios on gastos_diarios;
-- nombres anteriores (por si existían)
drop trigger if exists set_updated_at_materiales    on materiales;
drop trigger if exists set_updated_at_productos     on productos;
drop trigger if exists set_updated_at_ventas        on ventas;
drop trigger if exists set_updated_at_gastos_diarios on gastos_diarios;

create trigger trg_updated_at_materiales
  before update on materiales for each row execute procedure public.set_updated_at();
create trigger trg_updated_at_productos
  before update on productos for each row execute procedure public.set_updated_at();
create trigger trg_updated_at_ventas
  before update on ventas for each row execute procedure public.set_updated_at();
create trigger trg_updated_at_gastos_diarios
  before update on gastos_diarios for each row execute procedure public.set_updated_at();

-- ============================================================
-- CONFIG POR DEFECTO
-- ============================================================

create or replace function public.insert_default_config(p_store_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into store_config (store_id, clave, valor) values
    (p_store_id, 'regimen',                  'Monotributo'),
    (p_store_id, 'iva_rate',                 '0.21'),
    (p_store_id, 'iibb_rate',               '0.03'),
    (p_store_id, 'mipyme_reduccion',        '0.50'),
    (p_store_id, 'tn_store_id',             ''),
    (p_store_id, 'tn_access_token',         ''),
    (p_store_id, 'tn_comision_pct',         '0.01'),
    (p_store_id, 'mp_al_instante',          '0.0660'),
    (p_store_id, 'mp_10_dias',              '0.0460'),
    (p_store_id, 'mp_18_dias',              '0.0355'),
    (p_store_id, 'mp_35_dias',              '0.0156'),
    (p_store_id, 'mp_2_cuotas',             '0.0949'),
    (p_store_id, 'mp_3_cuotas',             '0.1219'),
    (p_store_id, 'descuento_transferencia', '0.10'),
    (p_store_id, 'envio_default_costo',     '0'),
    (p_store_id, 'envio_prioritario_profit','0'),
    (p_store_id, 'socio_1_nombre',          'Socio 1'),
    (p_store_id, 'socio_1_pct',             '0.50'),
    (p_store_id, 'socio_2_nombre',          'Socio 2'),
    (p_store_id, 'socio_2_pct',             '0.50')
  on conflict (store_id, clave) do nothing;
end;
$$;

-- ============================================================
-- FIN — VistaNube instalado correctamente
-- ============================================================
