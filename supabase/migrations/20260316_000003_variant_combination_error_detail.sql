-- Step 3: improve duplicate-combination error details with conflicting variant IDs.

create or replace function val_dev.catalog_validate_unique_variant_combinations()
returns trigger
language plpgsql
as $$
declare
  target_tenant_id uuid;
  target_product_id uuid;
  duplicate_signature text;
  duplicate_count integer;
  duplicate_variant_ids text;
begin
  target_tenant_id := coalesce(new.tenant_id, old.tenant_id);

  select v.product_id
    into target_product_id
  from val_dev.catalog_product_variants v
  where v.tenant_id = target_tenant_id
    and v.id = coalesce(new.variant_id, old.variant_id);

  if target_product_id is null then
    return coalesce(new, old);
  end if;

  with variant_sigs as (
    select
      v.id as variant_id,
      count(vav.attribute_id) as attr_count,
      md5(
        string_agg(
          vav.attribute_id::text || '=' || val_dev.catalog_variant_value_text(vav.value_jsonb),
          '|' order by vav.attribute_id::text
        )
      ) as combo_signature
    from val_dev.catalog_product_variants v
    left join val_dev.catalog_variant_attribute_values vav
      on vav.tenant_id = v.tenant_id
     and vav.variant_id = v.id
    where v.tenant_id = target_tenant_id
      and v.product_id = target_product_id
    group by v.id
  ), duplicate_groups as (
    select
      combo_signature,
      count(*) as group_count,
      string_agg(variant_id::text, ', ' order by variant_id::text) as variant_ids
    from variant_sigs
    where attr_count > 0
    group by combo_signature
    having count(*) > 1
  )
  select dg.combo_signature, dg.group_count, dg.variant_ids
    into duplicate_signature, duplicate_count, duplicate_variant_ids
  from duplicate_groups dg
  limit 1;

  if duplicate_signature is not null then
    raise exception
      'Duplicate variant combination detected for tenant %, product %. Conflicting variants: [%]. Signature: % (count: %)',
      target_tenant_id,
      target_product_id,
      duplicate_variant_ids,
      duplicate_signature,
      duplicate_count;
  end if;

  return coalesce(new, old);
end;
$$;
