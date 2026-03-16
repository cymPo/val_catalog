import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

type CreateCategoryBody = {
  tenantId?: string;
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
};

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
  const supabase = await createClient();

  const res = await supabase
    .schema("val_dev")
    .from("catalog_categories")
    .select("id, name, parent_id, path, depth, is_leaf, sort_order, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("path", { ascending: true });

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({
    tenantId,
    categories: res.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateCategoryBody;

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const name = body.name?.trim();
  const parentId = body.parentId ?? null;
  const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = await createClient();

  let parentPath = "";
  let depth = 0;
  if (parentId) {
    const parentRes = await supabase
      .schema("val_dev")
      .from("catalog_categories")
      .select("id, path, depth")
      .eq("tenant_id", tenantId)
      .eq("id", parentId)
      .single();

    if (parentRes.error || !parentRes.data) {
      return NextResponse.json({ error: "parent category not found" }, { status: 400 });
    }

    parentPath = parentRes.data.path;
    depth = Number(parentRes.data.depth) + 1;
  }

  const slug = await generateUniqueSlug({
    supabase,
    tenantId,
    parentId,
    baseName: name,
  });

  const path = parentPath ? `${parentPath}/${slug}` : `/${slug}`;

  const insertRes = await supabase
    .schema("val_dev")
    .from("catalog_categories")
    .insert({
      tenant_id: tenantId,
      parent_id: parentId,
      name,
      slug,
      path,
      depth,
      is_leaf: true,
      sort_order: sortOrder,
      is_active: true,
    })
    .select("id, name, parent_id, path, depth, is_leaf, sort_order")
    .single();

  if (insertRes.error) {
    return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
  }

  if (parentId) {
    await supabase
      .schema("val_dev")
      .from("catalog_categories")
      .update({ is_leaf: false })
      .eq("tenant_id", tenantId)
      .eq("id", parentId);
  }

  return NextResponse.json(
    {
      tenantId,
      category: insertRes.data,
    },
    { status: 201 }
  );
}

async function generateUniqueSlug({
  supabase,
  tenantId,
  parentId,
  baseName,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  parentId: string | null;
  baseName: string;
}) {
  const baseSlug = slugify(baseName);
  let candidate = baseSlug;
  let index = 2;

  for (;;) {
    let query = supabase
      .schema("val_dev")
      .from("catalog_categories")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", candidate)
      .limit(1);

    query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);

    const res = await query;
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

