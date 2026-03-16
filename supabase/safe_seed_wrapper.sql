-- Safe SQL wrapper for manual Supabase SQL Editor runs.
-- Goal: protect public schema and limit writes to val_dev only.
--
-- Usage:
-- 1) Paste this wrapper first.
-- 2) Paste your val_dev-only INSERT/UPDATE/DELETE statements where marked.
-- 3) Run verification queries.
-- 4) Replace ROLLBACK with COMMIT only when verified.

begin;

-- Guard 1: required schema must exist
do $$
begin
  if not exists (
    select 1
    from information_schema.schemata
    where schema_name = 'val_dev'
  ) then
    raise exception 'Safety stop: schema val_dev does not exist.';
  end if;
end
$$;

-- Guard 2: fail only if core catalog tables exist in public (conflicts with val_dev model)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'catalog_categories',
        'catalog_products',
        'catalog_product_variants',
        'catalog_attribute_definitions',
        'catalog_attribute_options',
        'catalog_product_attribute_values',
        'catalog_variant_attribute_values',
        'catalog_vendors',
        'catalog_variant_vendor_prices'
      )
  ) then
    raise exception 'Safety stop: core catalog tables exist in public schema.';
  end if;
end
$$;

-- Prefer val_dev resolution for unqualified names, but still use explicit val_dev.* in your SQL.
set local search_path = val_dev, public;

-- =========================================================
-- VAL_DEV-ONLY DML START (paste your seed statements below)
-- =========================================================

-- Example:
-- insert into val_dev.catalog_categories (...) values (...);

-- =======================================================
-- VAL_DEV-ONLY DML END
-- =======================================================

-- Verification block (read-only checks before commit)
select 'val_dev.categories' as table_name, count(*) as total
from val_dev.catalog_categories
union all
select 'val_dev.products', count(*) from val_dev.catalog_products
union all
select 'val_dev.variants', count(*) from val_dev.catalog_product_variants
union all
select 'val_dev.variant_attr_values', count(*) from val_dev.catalog_variant_attribute_values;

-- Keep this as ROLLBACK for dry-runs.
-- Change to COMMIT only after validating the results above.
rollback;
