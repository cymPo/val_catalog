-- Seed data for catalog core schema.
-- Safe for repeated runs because each section clears by tenant_id first.

begin;

-- Use a fixed tenant UUID for local development.
with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_variant_vendor_prices where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_vendors where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_product_group_items where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_product_groups where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_variant_attribute_values where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_product_attribute_values where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_attribute_options where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_attribute_definitions where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_product_variants where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_products where tenant_id = (select tenant_id from seed_tenant);

with seed_tenant as (
  select '11111111-1111-1111-1111-111111111111'::uuid as tenant_id
)
delete from val_dev.catalog_categories where tenant_id = (select tenant_id from seed_tenant);

-- Categories.
insert into val_dev.catalog_categories (id, tenant_id, parent_id, name, slug, path, depth, is_leaf, sort_order)
values
  ('00000000-0000-0000-0000-000000000101', '11111111-1111-1111-1111-111111111111', null, 'Electrical', 'electrical', '/electrical', 0, false, 10),
  ('00000000-0000-0000-0000-000000000102', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000101', 'Wire', 'wire', '/electrical/wire', 1, false, 10),
  ('00000000-0000-0000-0000-000000000103', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000102', 'Copper Wire', 'copper-wire', '/electrical/wire/copper-wire', 2, true, 10),
  ('00000000-0000-0000-0000-000000000201', '11111111-1111-1111-1111-111111111111', null, 'Plumbing', 'plumbing', '/plumbing', 0, false, 20),
  ('00000000-0000-0000-0000-000000000202', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000201', 'Fittings', 'fittings', '/plumbing/fittings', 1, true, 10);

-- Products.
insert into val_dev.catalog_products (id, tenant_id, category_id, name, slug, description, brand, status, default_uom)
values
  ('00000000-0000-0000-0000-000000001001', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000103', 'THHN Copper Wire', 'thhn-copper-wire', 'Building wire for conduit and raceways', 'Southwire', 'active', 'ft'),
  ('00000000-0000-0000-0000-000000001002', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000202', 'PVC 90 Elbow', 'pvc-90-elbow', 'Schedule 40 PVC elbow fitting', 'Charlotte Pipe', 'active', 'ea');

-- Variants.
insert into val_dev.catalog_product_variants (id, tenant_id, product_id, sku, name, status, price, currency_code, pack_size, uom, is_default)
values
  ('00000000-0000-0000-0000-000000002001', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000001001', 'WIRE-THHN-12-500', '12 AWG THHN - 500ft Spool', 'active', 129.99, 'USD', 500, 'ft', true),
  ('00000000-0000-0000-0000-000000002002', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000001001', 'WIRE-THHN-12-1000', '12 AWG THHN - 1000ft Spool', 'active', 249.99, 'USD', 1000, 'ft', false),
  ('00000000-0000-0000-0000-000000002003', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000001002', 'PVC-90-ELB-1IN', 'PVC 90 Elbow - 1 inch', 'active', 1.19, 'USD', 1, 'ea', true);

-- Attributes.
insert into val_dev.catalog_attribute_definitions (id, tenant_id, name, code, scope, data_type, is_filterable, is_required, sort_order)
values
  ('00000000-0000-0000-0000-000000003001', '11111111-1111-1111-1111-111111111111', 'Gauge', 'gauge', 'variant', 'select', true, true, 10),
  ('00000000-0000-0000-0000-000000003002', '11111111-1111-1111-1111-111111111111', 'Material', 'material', 'product', 'select', true, true, 20),
  ('00000000-0000-0000-0000-000000003003', '11111111-1111-1111-1111-111111111111', 'Length (ft)', 'length_ft', 'variant', 'select', true, true, 30);

insert into val_dev.catalog_attribute_options (id, tenant_id, attribute_id, label, value, sort_order)
values
  ('00000000-0000-0000-0000-000000004001', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000003001', '12 AWG', '12awg', 10),
  ('00000000-0000-0000-0000-000000004002', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000003002', 'Copper', 'copper', 10),
  ('00000000-0000-0000-0000-000000004003', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000003002', 'PVC', 'pvc', 20),
  ('00000000-0000-0000-0000-000000004004', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000003003', '500 ft', '500', 10),
  ('00000000-0000-0000-0000-000000004005', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000003003', '1000 ft', '1000', 20);

insert into val_dev.catalog_product_attribute_values (id, tenant_id, product_id, attribute_id, value_jsonb)
values
  ('00000000-0000-0000-0000-000000005001', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000003002', '{"value": "copper"}'::jsonb),
  ('00000000-0000-0000-0000-000000005002', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000003002', '{"value": "pvc"}'::jsonb);

insert into val_dev.catalog_variant_attribute_values (id, tenant_id, variant_id, attribute_id, value_jsonb)
values
  ('00000000-0000-0000-0000-000000006001', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000003001', '{"value": "12awg"}'::jsonb),
  ('00000000-0000-0000-0000-000000006002', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000003003', '{"value": "500"}'::jsonb),
  ('00000000-0000-0000-0000-000000006003', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000003001', '{"value": "12awg"}'::jsonb),
  ('00000000-0000-0000-0000-000000006004', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000003003', '{"value": "1000"}'::jsonb);

-- Vendors and offers.
insert into val_dev.catalog_vendors (id, tenant_id, name, code, is_active)
values
  ('00000000-0000-0000-0000-000000007001', '11111111-1111-1111-1111-111111111111', 'Amazon', 'amazon', true),
  ('00000000-0000-0000-0000-000000007002', '11111111-1111-1111-1111-111111111111', 'Home Depot', 'homedepot', true);

insert into val_dev.catalog_variant_vendor_prices (
  id, tenant_id, variant_id, vendor_id, vendor_sku, price, currency_code, min_order_qty, lead_time_days, is_active, effective_from
)
values
  ('00000000-0000-0000-0000-000000008001', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000007001', 'AMZ-THHN12-500', 128.49, 'USD', 1, 2, true, now() - interval '7 days'),
  ('00000000-0000-0000-0000-000000008002', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000007002', 'HD-THHN12-500', 131.10, 'USD', 1, 1, true, now() - interval '7 days'),
  ('00000000-0000-0000-0000-000000008003', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000002003', '00000000-0000-0000-0000-000000007002', 'HD-PVC90-1IN', 1.09, 'USD', 10, 1, true, now() - interval '7 days');

commit;
