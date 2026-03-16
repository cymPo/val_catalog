import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

type CreateProductBody = {
  tenantId?: string;
  categoryId?: string;
  name?: string;
  brand?: string | null;
  description?: string | null;
  defaultUom?: string | null;
  status?: "active" | "draft" | "archived";
};

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
  const categoryId = request.nextUrl.searchParams.get("categoryId");
  const supabase = await createClient();

  let query = supabase
    .schema("val_dev")
    .from("catalog_products")
    .select("id, category_id, name, slug, brand, status, default_uom, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const res = await query;
  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({
    tenantId,
    products: res.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateProductBody;

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const categoryId = body.categoryId?.trim();
  const name = body.name?.trim();

  if (!categoryId) {
    return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const slug = await generateUniqueProductSlug({
    supabase,
    tenantId,
    baseName: name,
  });

  const insertRes = await supabase
    .schema("val_dev")
    .from("catalog_products")
    .insert({
      tenant_id: tenantId,
      category_id: categoryId,
      name,
      slug,
      description: body.description?.trim() || null,
      brand: body.brand?.trim() || null,
      status: body.status ?? "active",
      default_uom: body.defaultUom?.trim() || null,
      is_active: true,
    })
    .select("id, category_id, name, slug, brand, status, default_uom")
    .single();

  if (insertRes.error) {
    return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      tenantId,
      product: insertRes.data,
    },
    { status: 201 }
  );
}

async function generateUniqueProductSlug({
  supabase,
  tenantId,
  baseName,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  baseName: string;
}) {
  const baseSlug = slugify(baseName);
  let candidate = baseSlug;
  let index = 2;

  for (;;) {
    const res = await supabase
      .schema("val_dev")
      .from("catalog_products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", candidate)
      .limit(1);

    if (res.error) {
      throw new Error(res.error.message);
    }

    if (!res.data || res.data.length === 0) {
      return candidate;
    }

    candidate = `${baseSlug}-${index}`;
    index += 1;
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

