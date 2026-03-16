-- Catalog core schema for purchasing app.
-- Step 1: core entities, constraints, and indexes.

create extension if not exists pgcrypto;
create schema if not exists val_dev;

create or replace function val_dev.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists val_dev.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  parent_id uuid null,
  name text not null,
  slug text not null,
  path text not null,
  depth integer not null check (depth >= 0),
  is_leaf boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, path),
  unique (tenant_id, parent_id, slug),
  constraint catalog_categories_parent_fk
    foreign key (tenant_id, parent_id)
    references val_dev.catalog_categories (tenant_id, id)
    on delete set null
);

create table if not exists val_dev.catalog_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  category_id uuid not null,
  name text not null,
  slug text not null,
  description text null,
  brand text null,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  default_uom text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, slug),
  constraint catalog_products_category_fk
    foreign key (tenant_id, category_id)
    references val_dev.catalog_categories (tenant_id, id)
    on delete restrict
);

create table if not exists val_dev.catalog_product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null,
  sku text not null,
  name text not null,
  barcode text null,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  price numeric(14,2) null check (price is null or price >= 0),
  currency_code text null,
  pack_size numeric(14,4) null check (pack_size is null or pack_size > 0),
  uom text null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, sku),
  constraint catalog_variants_product_fk
    foreign key (tenant_id, product_id)
    references val_dev.catalog_products (tenant_id, id)
    on delete cascade
);

create table if not exists val_dev.catalog_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  code text not null,
  scope text not null check (scope in ('product', 'variant', 'both')),
  data_type text not null check (data_type in ('text', 'number', 'boolean', 'select', 'multi_select')),
  is_filterable boolean not null default false,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table if not exists val_dev.catalog_attribute_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  attribute_id uuid not null,
  label text not null,
  value text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, attribute_id, value),
  constraint catalog_attribute_options_attribute_fk
    foreign key (tenant_id, attribute_id)
    references val_dev.catalog_attribute_definitions (tenant_id, id)
    on delete cascade
);

create table if not exists val_dev.catalog_product_attribute_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null,
  attribute_id uuid not null,
  value_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, product_id, attribute_id),
  constraint catalog_product_attr_values_product_fk
    foreign key (tenant_id, product_id)
    references val_dev.catalog_products (tenant_id, id)
    on delete cascade,
  constraint catalog_product_attr_values_attribute_fk
    foreign key (tenant_id, attribute_id)
    references val_dev.catalog_attribute_definitions (tenant_id, id)
    on delete cascade
);

create table if not exists val_dev.catalog_variant_attribute_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  variant_id uuid not null,
  attribute_id uuid not null,
  value_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, variant_id, attribute_id),
  constraint catalog_variant_attr_values_variant_fk
    foreign key (tenant_id, variant_id)
    references val_dev.catalog_product_variants (tenant_id, id)
    on delete cascade,
  constraint catalog_variant_attr_values_attribute_fk
    foreign key (tenant_id, attribute_id)
    references val_dev.catalog_attribute_definitions (tenant_id, id)
    on delete cascade
);

create table if not exists val_dev.catalog_product_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  owner_user_id uuid not null,
  name text not null,
  description text null,
  visibility text not null default 'private' check (visibility in ('private', 'shared', 'public_within_tenant')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, owner_user_id, name),
  constraint catalog_product_groups_owner_fk
    foreign key (owner_user_id)
    references auth.users (id)
    on delete cascade
);

create table if not exists val_dev.catalog_product_group_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  group_id uuid not null,
  item_type text not null check (item_type in ('product', 'variant')),
  item_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, group_id, item_type, item_id),
  constraint catalog_group_items_group_fk
    foreign key (tenant_id, group_id)
    references val_dev.catalog_product_groups (tenant_id, id)
    on delete cascade
);

create index if not exists idx_catalog_categories_tenant_parent
  on val_dev.catalog_categories (tenant_id, parent_id);

create index if not exists idx_catalog_categories_tenant_path
  on val_dev.catalog_categories (tenant_id, path);

create index if not exists idx_catalog_products_tenant_category
  on val_dev.catalog_products (tenant_id, category_id);

create index if not exists idx_catalog_variants_tenant_product
  on val_dev.catalog_product_variants (tenant_id, product_id);

create index if not exists idx_catalog_group_items_group
  on val_dev.catalog_product_group_items (tenant_id, group_id, item_type, item_id);

create or replace function val_dev.catalog_validate_product_leaf_category()
returns trigger
language plpgsql
as $$
declare
  category_leaf boolean;
begin
  select c.is_leaf
    into category_leaf
  from val_dev.catalog_categories c
  where c.id = new.category_id
    and c.tenant_id = new.tenant_id;

  if category_leaf is distinct from true then
    raise exception 'Product category must be a leaf category (tenant_id: %, category_id: %)', new.tenant_id, new.category_id;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_catalog_products_leaf_category on val_dev.catalog_products;
create trigger tr_catalog_products_leaf_category
before insert or update of category_id, tenant_id on val_dev.catalog_products
for each row
execute function val_dev.catalog_validate_product_leaf_category();

create or replace function val_dev.catalog_validate_group_item()
returns trigger
language plpgsql
as $$
declare
  record_exists boolean;
begin
  if new.item_type = 'product' then
    select exists (
      select 1
      from val_dev.catalog_products p
      where p.id = new.item_id
        and p.tenant_id = new.tenant_id
    ) into record_exists;
  elsif new.item_type = 'variant' then
    select exists (
      select 1
      from val_dev.catalog_product_variants v
      where v.id = new.item_id
        and v.tenant_id = new.tenant_id
    ) into record_exists;
  else
    record_exists := false;
  end if;

  if record_exists is not true then
    raise exception 'catalog_product_group_items item does not exist for tenant (item_type: %, item_id: %)', new.item_type, new.item_id;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_catalog_group_items_validate on val_dev.catalog_product_group_items;
create trigger tr_catalog_group_items_validate
before insert or update of item_type, item_id, tenant_id on val_dev.catalog_product_group_items
for each row
execute function val_dev.catalog_validate_group_item();

drop trigger if exists tr_catalog_categories_set_updated_at on val_dev.catalog_categories;
create trigger tr_catalog_categories_set_updated_at
before update on val_dev.catalog_categories
for each row
execute function val_dev.set_updated_at();

drop trigger if exists tr_catalog_products_set_updated_at on val_dev.catalog_products;
create trigger tr_catalog_products_set_updated_at
before update on val_dev.catalog_products
for each row
execute function val_dev.set_updated_at();

drop trigger if exists tr_catalog_variants_set_updated_at on val_dev.catalog_product_variants;
create trigger tr_catalog_variants_set_updated_at
before update on val_dev.catalog_product_variants
for each row
execute function val_dev.set_updated_at();

drop trigger if exists tr_catalog_attr_defs_set_updated_at on val_dev.catalog_attribute_definitions;
create trigger tr_catalog_attr_defs_set_updated_at
before update on val_dev.catalog_attribute_definitions
for each row
execute function val_dev.set_updated_at();

drop trigger if exists tr_catalog_attr_opts_set_updated_at on val_dev.catalog_attribute_options;
create trigger tr_catalog_attr_opts_set_updated_at
before update on val_dev.catalog_attribute_options
for each row
execute function val_dev.set_updated_at();

drop trigger if exists tr_catalog_product_attr_vals_set_updated_at on val_dev.catalog_product_attribute_values;
create trigger tr_catalog_product_attr_vals_set_updated_at
before update on val_dev.catalog_product_attribute_values
for each row
execute function val_dev.set_updated_at();

drop trigger if exists tr_catalog_variant_attr_vals_set_updated_at on val_dev.catalog_variant_attribute_values;
create trigger tr_catalog_variant_attr_vals_set_updated_at
before update on val_dev.catalog_variant_attribute_values
for each row
execute function val_dev.set_updated_at();

drop trigger if exists tr_catalog_groups_set_updated_at on val_dev.catalog_product_groups;
create trigger tr_catalog_groups_set_updated_at
before update on val_dev.catalog_product_groups
for each row
execute function val_dev.set_updated_at();

drop trigger if exists tr_catalog_group_items_set_updated_at on val_dev.catalog_product_group_items;
create trigger tr_catalog_group_items_set_updated_at
before update on val_dev.catalog_product_group_items
for each row
execute function val_dev.set_updated_at();

