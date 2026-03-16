-- Step 4: vendor master + vendor-specific variant pricing.

create table if not exists val_dev.catalog_vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table if not exists val_dev.catalog_variant_vendor_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  variant_id uuid not null,
  vendor_id uuid not null,
  vendor_sku text null,
  price numeric(14,2) not null check (price >= 0),
  currency_code text not null default 'USD',
  min_order_qty numeric(14,4) not null default 1 check (min_order_qty > 0),
  lead_time_days integer null check (lead_time_days is null or lead_time_days >= 0),
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_variant_vendor_prices_variant_fk
    foreign key (tenant_id, variant_id)
    references val_dev.catalog_product_variants (tenant_id, id)
    on delete cascade,
  constraint catalog_variant_vendor_prices_vendor_fk
    foreign key (tenant_id, vendor_id)
    references val_dev.catalog_vendors (tenant_id, id)
    on delete cascade,
  constraint catalog_variant_vendor_prices_effective_dates_ck
    check (effective_to is null or effective_to > effective_from)
);

create index if not exists idx_catalog_vendors_tenant_active
  on val_dev.catalog_vendors (tenant_id, is_active);

create index if not exists idx_catalog_variant_vendor_prices_variant
  on val_dev.catalog_variant_vendor_prices (tenant_id, variant_id, is_active);

create index if not exists idx_catalog_variant_vendor_prices_vendor
  on val_dev.catalog_variant_vendor_prices (tenant_id, vendor_id, is_active);

create index if not exists idx_catalog_variant_vendor_prices_effective
  on val_dev.catalog_variant_vendor_prices (tenant_id, effective_from, effective_to);

drop trigger if exists tr_catalog_vendors_set_updated_at on val_dev.catalog_vendors;
create trigger tr_catalog_vendors_set_updated_at
before update on val_dev.catalog_vendors
for each row
execute function val_dev.set_updated_at();

drop trigger if exists tr_catalog_variant_vendor_prices_set_updated_at on val_dev.catalog_variant_vendor_prices;
create trigger tr_catalog_variant_vendor_prices_set_updated_at
before update on val_dev.catalog_variant_vendor_prices
for each row
execute function val_dev.set_updated_at();
