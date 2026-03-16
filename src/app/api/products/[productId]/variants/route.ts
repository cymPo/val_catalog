import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

type VariantAttribute = {
  attributeId: string;
  code: string;
  name: string;
  value: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;

  const supabase = await createClient();

  const variantsRes = await supabase
    .schema("val_dev")
    .from("catalog_product_variants")
    .select("id, name, sku, price, currency_code, pack_size, uom, is_default, is_active")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (variantsRes.error) {
    return NextResponse.json({ error: variantsRes.error.message }, { status: 500 });
  }

  const variants = variantsRes.data ?? [];
  const variantIds = variants.map((variant) => variant.id);

  const attrValuesRes =
    variantIds.length > 0
      ? await supabase
          .schema("val_dev")
          .from("catalog_variant_attribute_values")
          .select("variant_id, attribute_id, value_jsonb")
          .eq("tenant_id", tenantId)
          .in("variant_id", variantIds)
      : { data: [], error: null };

  if (attrValuesRes.error) {
    return NextResponse.json({ error: attrValuesRes.error.message }, { status: 500 });
  }

  const attributeIds = [...new Set((attrValuesRes.data ?? []).map((row) => row.attribute_id))];

  const attrDefsRes =
    attributeIds.length > 0
      ? await supabase
          .schema("val_dev")
          .from("catalog_attribute_definitions")
          .select("id, code, name")
          .eq("tenant_id", tenantId)
          .in("id", attributeIds)
      : { data: [], error: null };

  if (attrDefsRes.error) {
    return NextResponse.json({ error: attrDefsRes.error.message }, { status: 500 });
  }

  const attrDefById = new Map((attrDefsRes.data ?? []).map((def) => [def.id, def]));
  const attrsByVariantId = new Map<string, VariantAttribute[]>();

  for (const row of attrValuesRes.data ?? []) {
    const def = attrDefById.get(row.attribute_id);
    if (!def) continue;

    const current = attrsByVariantId.get(row.variant_id) ?? [];
    const extractedValue = extractValue(row.value_jsonb);

    current.push({
      attributeId: row.attribute_id,
      code: def.code,
      name: def.name,
      value: extractedValue,
    });

    attrsByVariantId.set(row.variant_id, current);
  }

  for (const [variantId, attrs] of attrsByVariantId.entries()) {
    attrs.sort((a, b) => a.name.localeCompare(b.name));
    attrsByVariantId.set(variantId, attrs);
  }

  return NextResponse.json({
    tenantId,
    productId,
    variants: variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      currencyCode: variant.currency_code,
      packSize: variant.pack_size,
      uom: variant.uom,
      isDefault: variant.is_default,
      attributes: attrsByVariantId.get(variant.id) ?? [],
    })),
  });
}

function extractValue(valueJsonb: unknown): string {
  if (valueJsonb && typeof valueJsonb === "object" && !Array.isArray(valueJsonb)) {
    const value = (valueJsonb as { value?: unknown }).value;
    if (value === null || value === undefined) return "";
    return String(value);
  }

  if (valueJsonb === null || valueJsonb === undefined) return "";
  return String(valueJsonb);
}
