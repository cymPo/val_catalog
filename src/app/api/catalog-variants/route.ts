import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

type VariantAttributeInput = {
  code: string;
  name?: string;
  value: string;
  sortOrder?: number;
};

type CreateVariantBody = {
  tenantId?: string;
  productId?: string;
  name?: string;
  sku?: string;
  price?: number | null;
  currencyCode?: string | null;
  packSize?: number | null;
  uom?: string | null;
  isDefault?: boolean;
  attributes?: VariantAttributeInput[];
};

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
  const productId = request.nextUrl.searchParams.get("productId");
  const supabase = await createClient();

  let query = supabase
    .schema("val_dev")
    .from("catalog_product_variants")
    .select("id, product_id, sku, name, price, currency_code, pack_size, uom, is_default, status, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const res = await query;
  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({
    tenantId,
    variants: res.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateVariantBody;

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const productId = body.productId?.trim();
  const name = body.name?.trim();

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = await createClient();

  if (body.isDefault) {
    const resetRes = await supabase
      .schema("val_dev")
      .from("catalog_product_variants")
      .update({ is_default: false })
      .eq("tenant_id", tenantId)
      .eq("product_id", productId);

    if (resetRes.error) {
      return NextResponse.json({ error: resetRes.error.message }, { status: 500 });
    }
  }

  const sku = body.sku?.trim() || `VAR-${randomUUID().slice(0, 8).toUpperCase()}`;

  const insertRes = await supabase
    .schema("val_dev")
    .from("catalog_product_variants")
    .insert({
      tenant_id: tenantId,
      product_id: productId,
      sku,
      name,
      status: "active",
      price: body.price ?? null,
      currency_code: body.currencyCode?.trim() || null,
      pack_size: body.packSize ?? null,
      uom: body.uom?.trim() || null,
      is_default: Boolean(body.isDefault),
      is_active: true,
    })
    .select("id, product_id, sku, name, price, currency_code, pack_size, uom, is_default")
    .single();

  if (insertRes.error || !insertRes.data) {
    return NextResponse.json({ error: insertRes.error?.message ?? "failed to create variant" }, { status: 500 });
  }

  const variant = insertRes.data;
  const attributes = (body.attributes ?? []).filter(
    (item) => item.code?.trim() && item.value?.trim()
  );

  if (attributes.length > 0) {
    const normalized = attributes.map((item, index) => ({
      code: item.code.trim().toLowerCase(),
      name: item.name?.trim() || item.code.trim(),
      value: item.value.trim(),
      sortOrder: Number.isFinite(item.sortOrder) ? Number(item.sortOrder) : (index + 1) * 10,
    }));

    const codes = [...new Set(normalized.map((a) => a.code))];

    const defsRes = await supabase
      .schema("val_dev")
      .from("catalog_attribute_definitions")
      .select("id, code")
      .eq("tenant_id", tenantId)
      .in("code", codes);

    if (defsRes.error) {
      return NextResponse.json({ error: defsRes.error.message }, { status: 500 });
    }

    const existingByCode = new Map((defsRes.data ?? []).map((row) => [row.code, row.id]));
    const missing = normalized.filter((item) => !existingByCode.has(item.code));

    if (missing.length > 0) {
      const defsInsertRes = await supabase
        .schema("val_dev")
        .from("catalog_attribute_definitions")
        .insert(
          missing.map((item) => ({
            tenant_id: tenantId,
            name: item.name,
            code: item.code,
            scope: "variant",
            data_type: "select",
            is_filterable: true,
            is_required: false,
            sort_order: item.sortOrder,
          }))
        )
        .select("id, code");

      if (defsInsertRes.error) {
        return NextResponse.json({ error: defsInsertRes.error.message }, { status: 500 });
      }

      for (const row of defsInsertRes.data ?? []) {
        existingByCode.set(row.code, row.id);
      }
    }

    const valueInsertRes = await supabase
      .schema("val_dev")
      .from("catalog_variant_attribute_values")
      .insert(
        normalized.map((item) => ({
          tenant_id: tenantId,
          variant_id: variant.id,
          attribute_id: existingByCode.get(item.code),
          value_jsonb: { value: item.value },
        }))
      );

    if (valueInsertRes.error) {
      return NextResponse.json({ error: valueInsertRes.error.message }, { status: 500 });
    }

    const optionRows = normalized
      .map((item) => ({
        attribute_id: existingByCode.get(item.code),
        label: item.value,
        value: item.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
        sort_order: item.sortOrder,
      }))
      .filter((row): row is { attribute_id: string; label: string; value: string; sort_order: number } =>
        Boolean(row.attribute_id)
      );

    if (optionRows.length > 0) {
      const optionRes = await supabase
        .schema("val_dev")
        .from("catalog_attribute_options")
        .upsert(
          optionRows.map((row) => ({
            tenant_id: tenantId,
            attribute_id: row.attribute_id,
            label: row.label,
            value: row.value,
            sort_order: row.sort_order,
          })),
          { onConflict: "tenant_id,attribute_id,value" }
        );

      if (optionRes.error) {
        return NextResponse.json({ error: optionRes.error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json(
    {
      tenantId,
      variant,
    },
    { status: 201 }
  );
}

