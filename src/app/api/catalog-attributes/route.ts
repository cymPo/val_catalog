import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

type CreateAttributeBody = {
  tenantId?: string;
  attributeId?: string;
  name?: string;
  code?: string;
  options?: string[];
};

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
  const supabase = await createClient();

  const defsRes = await supabase
    .schema("val_dev")
    .from("catalog_attribute_definitions")
    .select("id, name, code, sort_order")
    .eq("tenant_id", tenantId)
    .eq("scope", "variant")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (defsRes.error) {
    return NextResponse.json({ error: defsRes.error.message }, { status: 500 });
  }

  const definitions = defsRes.data ?? [];
  const defIds = definitions.map((d) => d.id);

  const optionsRes =
    defIds.length > 0
      ? await supabase
          .schema("val_dev")
          .from("catalog_attribute_options")
          .select("attribute_id, label, value, sort_order")
          .eq("tenant_id", tenantId)
          .in("attribute_id", defIds)
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true })
      : { data: [], error: null };

  if (optionsRes.error) {
    return NextResponse.json({ error: optionsRes.error.message }, { status: 500 });
  }

  const optionsByAttributeId = new Map<string, Array<{ label: string; value: string }>>();
  for (const row of optionsRes.data ?? []) {
    const current = optionsByAttributeId.get(row.attribute_id) ?? [];
    current.push({ label: row.label, value: row.value });
    optionsByAttributeId.set(row.attribute_id, current);
  }

  return NextResponse.json({
    tenantId,
    attributes: definitions.map((def) => ({
      id: def.id,
      name: def.name,
      code: def.code,
      options: optionsByAttributeId.get(def.id) ?? [],
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateAttributeBody;
  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const name = body.name?.trim();
  const code = normalizeCode(body.code?.trim() || name || "");
  const options = (body.options ?? []).map((o) => o.trim()).filter((o) => o.length > 0);

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const upsertRes = await supabase
    .schema("val_dev")
    .from("catalog_attribute_definitions")
    .upsert(
      {
        tenant_id: tenantId,
        name,
        code,
        scope: "variant",
        data_type: "select",
        is_filterable: true,
        is_required: false,
        sort_order: 0,
      },
      { onConflict: "tenant_id,code" }
    )
    .select("id, name, code")
    .single();

  if (upsertRes.error || !upsertRes.data) {
    return NextResponse.json({ error: upsertRes.error?.message ?? "failed to create attribute" }, { status: 500 });
  }

  if (options.length > 0) {
    const optionRows = options.map((label, index) => ({
      tenant_id: tenantId,
      attribute_id: upsertRes.data.id,
      label,
      value: normalizeOptionValue(label),
      sort_order: (index + 1) * 10,
    }));

    const optionsInsertRes = await supabase
      .schema("val_dev")
      .from("catalog_attribute_options")
      .upsert(optionRows, { onConflict: "tenant_id,attribute_id,value" });

    if (optionsInsertRes.error) {
      return NextResponse.json({ error: optionsInsertRes.error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      tenantId,
      attribute: upsertRes.data,
      optionsCount: options.length,
    },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as CreateAttributeBody;
  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const attributeId = body.attributeId?.trim();
  const name = body.name?.trim();
  const code = normalizeCode(body.code?.trim() || "");
  const options = (body.options ?? []).map((o) => o.trim()).filter((o) => o.length > 0);

  if (!attributeId) {
    return NextResponse.json({ error: "attributeId is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const updateDefRes = await supabase
    .schema("val_dev")
    .from("catalog_attribute_definitions")
    .update({
      name,
      code,
    })
    .eq("tenant_id", tenantId)
    .eq("id", attributeId)
    .select("id, name, code")
    .single();

  if (updateDefRes.error || !updateDefRes.data) {
    return NextResponse.json({ error: updateDefRes.error?.message ?? "failed to update attribute" }, { status: 500 });
  }

  const normalizedOptions = options.map((label, index) => ({
    tenant_id: tenantId,
    attribute_id: attributeId,
    label,
    value: normalizeOptionValue(label),
    sort_order: (index + 1) * 10,
  }));

  if (normalizedOptions.length > 0) {
    const upsertOptionsRes = await supabase
      .schema("val_dev")
      .from("catalog_attribute_options")
      .upsert(normalizedOptions, { onConflict: "tenant_id,attribute_id,value" });

    if (upsertOptionsRes.error) {
      return NextResponse.json({ error: upsertOptionsRes.error.message }, { status: 500 });
    }
  }

  const keepValues = new Set(normalizedOptions.map((o) => o.value));
  const currentOptionsRes = await supabase
    .schema("val_dev")
    .from("catalog_attribute_options")
    .select("id, value")
    .eq("tenant_id", tenantId)
    .eq("attribute_id", attributeId);

  if (currentOptionsRes.error) {
    return NextResponse.json({ error: currentOptionsRes.error.message }, { status: 500 });
  }

  const removeIds = (currentOptionsRes.data ?? [])
    .filter((row) => !keepValues.has(row.value))
    .map((row) => row.id);

  if (removeIds.length > 0) {
    const deleteRes = await supabase
      .schema("val_dev")
      .from("catalog_attribute_options")
      .delete()
      .eq("tenant_id", tenantId)
      .in("id", removeIds);

    if (deleteRes.error) {
      return NextResponse.json({ error: deleteRes.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    tenantId,
    attribute: updateDefRes.data,
    optionsCount: normalizedOptions.length,
  });
}

function normalizeCode(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function normalizeOptionValue(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}
