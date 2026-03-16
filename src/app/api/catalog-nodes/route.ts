import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

type CatalogResponse = {
  scope: "root" | "category" | "group";
  tenantId: string;
  nodes: Array<Record<string, unknown>>;
};

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
  const categoryId = request.nextUrl.searchParams.get("categoryId");
  const groupId = request.nextUrl.searchParams.get("groupId");
  const leafOnly = request.nextUrl.searchParams.get("leafOnly") === "true";
  const parentCategoryId = request.nextUrl.searchParams.get("parentCategoryId");
  const search = request.nextUrl.searchParams.get("search");

  const supabase = await createClient();

  if (leafOnly) {
    return getLeafCategoryNodes({ supabase, tenantId, parentCategoryId, search });
  }

  if (groupId) {
    return getGroupNodes({ supabase, tenantId, groupId });
  }

  if (categoryId) {
    return getCategoryNodes({ supabase, tenantId, categoryId });
  }

  return getRootNodes({ supabase, tenantId });
}

async function getLeafCategoryNodes({
  supabase,
  tenantId,
  parentCategoryId,
  search,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  parentCategoryId: string | null;
  search: string | null;
}) {
  let parentPath: string | null = null;

  if (parentCategoryId) {
    const parentRes = await supabase
      .schema("val_dev")
      .from("catalog_categories")
      .select("path")
      .eq("tenant_id", tenantId)
      .eq("id", parentCategoryId)
      .single();

    if (parentRes.error) {
      return NextResponse.json({ error: parentRes.error.message }, { status: 500 });
    }

    parentPath = parentRes.data.path;
  }

  const leafRes = await supabase
    .schema("val_dev")
    .from("catalog_categories")
    .select("id, name, depth, is_leaf, path")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("is_leaf", true)
    .order("name", { ascending: true });

  if (leafRes.error) {
    return NextResponse.json({ error: leafRes.error.message }, { status: 500 });
  }

  const leaves =
    parentPath === null
      ? leafRes.data ?? []
      : (leafRes.data ?? []).filter(
          (leaf) => leaf.path === parentPath || leaf.path.startsWith(`${parentPath}/`)
        );

  const normalizedSearch = search?.trim().toLowerCase() ?? "";
  if (!normalizedSearch) {
    return NextResponse.json<CatalogResponse>({
      scope: "category",
      tenantId,
      nodes: leaves.map((leaf) => ({
        type: "category",
        id: leaf.id,
        name: leaf.name,
        depth: leaf.depth,
        hasChildren: !leaf.is_leaf,
      })),
    });
  }

  const matchedByLeafName = new Set(
    leaves
      .filter((leaf) => leaf.name.toLowerCase().includes(normalizedSearch))
      .map((leaf) => leaf.id)
  );

  const leafIds = leaves.map((leaf) => leaf.id);
  let matchedByProduct = new Set<string>();
  if (leafIds.length > 0) {
    const productsRes = await supabase
      .schema("val_dev")
      .from("catalog_products")
      .select("id, category_id, name, brand")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("category_id", leafIds);

    if (productsRes.error) {
      return NextResponse.json({ error: productsRes.error.message }, { status: 500 });
    }

    matchedByProduct = new Set(
      (productsRes.data ?? [])
        .filter((product) => {
          const haystack = `${product.name ?? ""} ${product.brand ?? ""}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        })
        .map((product) => product.category_id)
    );

    const products = productsRes.data ?? [];
    const productIds = products.map((p) => p.id);
    const categoryByProductId = new Map(products.map((p) => [p.id, p.category_id]));

    if (productIds.length > 0) {
      const variantsRes = await supabase
        .schema("val_dev")
        .from("catalog_product_variants")
        .select("id, product_id, name, sku")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .in("product_id", productIds);

      if (variantsRes.error) {
        return NextResponse.json({ error: variantsRes.error.message }, { status: 500 });
      }

      const variants = variantsRes.data ?? [];
      const variantIds = variants.map((v) => v.id);
      const productIdByVariantId = new Map(variants.map((v) => [v.id, v.product_id]));

      const attrValuesRes =
        variantIds.length > 0
          ? await supabase
              .schema("val_dev")
              .from("catalog_variant_attribute_values")
              .select("variant_id, value_jsonb")
              .eq("tenant_id", tenantId)
              .in("variant_id", variantIds)
          : { data: [], error: null };

      if (attrValuesRes.error) {
        return NextResponse.json({ error: attrValuesRes.error.message }, { status: 500 });
      }

      const attrTextByVariantId = new Map<string, string[]>();
      for (const row of attrValuesRes.data ?? []) {
        const current = attrTextByVariantId.get(row.variant_id) ?? [];
        const value =
          typeof row.value_jsonb === "object" &&
          row.value_jsonb !== null &&
          "value" in row.value_jsonb
            ? String((row.value_jsonb as { value?: unknown }).value ?? "")
            : JSON.stringify(row.value_jsonb ?? "");
        current.push(value.toLowerCase());
        attrTextByVariantId.set(row.variant_id, current);
      }

      for (const variant of variants) {
        const variantHaystack = `${variant.name ?? ""} ${variant.sku ?? ""}`.toLowerCase();
        const attrHaystack = (attrTextByVariantId.get(variant.id) ?? []).join(" ");
        if (
          variantHaystack.includes(normalizedSearch) ||
          attrHaystack.includes(normalizedSearch)
        ) {
          const productId = productIdByVariantId.get(variant.id);
          if (!productId) continue;
          const categoryId = categoryByProductId.get(productId);
          if (categoryId) {
            matchedByProduct.add(categoryId);
          }
        }
      }
    }
  }

  const filteredLeaves = leaves.filter(
    (leaf) => matchedByLeafName.has(leaf.id) || matchedByProduct.has(leaf.id)
  );

  return NextResponse.json<CatalogResponse>({
    scope: "category",
    tenantId,
    nodes: filteredLeaves.map((leaf) => ({
      type: "category",
      id: leaf.id,
      name: leaf.name,
      depth: leaf.depth,
      hasChildren: !leaf.is_leaf,
    })),
  });
}

async function getRootNodes({
  supabase,
  tenantId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
}) {
  const [groupsRes, categoriesRes] = await Promise.all([
    supabase
      .schema("val_dev")
      .from("catalog_product_groups")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .schema("val_dev")
      .from("catalog_categories")
      .select("id, name, depth, is_leaf")
      .eq("tenant_id", tenantId)
      .is("parent_id", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (groupsRes.error) {
    return NextResponse.json({ error: groupsRes.error.message }, { status: 500 });
  }

  if (categoriesRes.error) {
    return NextResponse.json({ error: categoriesRes.error.message }, { status: 500 });
  }

  const nodes = [
    ...(groupsRes.data ?? []).map((group) => ({
      type: "group",
      id: group.id,
      name: group.name,
    })),
    ...(categoriesRes.data ?? []).map((category) => ({
      type: "category",
      id: category.id,
      name: category.name,
      depth: category.depth,
      hasChildren: !category.is_leaf,
    })),
  ];

  return NextResponse.json<CatalogResponse>({
    scope: "root",
    tenantId,
    nodes,
  });
}

async function getCategoryNodes({
  supabase,
  tenantId,
  categoryId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  categoryId: string;
}) {
  const childCategoriesRes = await supabase
    .schema("val_dev")
    .from("catalog_categories")
    .select("id, name, depth, is_leaf")
    .eq("tenant_id", tenantId)
    .eq("parent_id", categoryId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (childCategoriesRes.error) {
    return NextResponse.json({ error: childCategoriesRes.error.message }, { status: 500 });
  }

  const childCategories = childCategoriesRes.data ?? [];
  if (childCategories.length > 0) {
    return NextResponse.json<CatalogResponse>({
      scope: "category",
      tenantId,
      nodes: childCategories.map((category) => ({
        type: "category",
        id: category.id,
        name: category.name,
        depth: category.depth,
        hasChildren: !category.is_leaf,
      })),
    });
  }

  const productsRes = await supabase
    .schema("val_dev")
    .from("catalog_products")
    .select("id, name, brand")
    .eq("tenant_id", tenantId)
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (productsRes.error) {
    return NextResponse.json({ error: productsRes.error.message }, { status: 500 });
  }

  const products = productsRes.data ?? [];
  const productIds = products.map((product) => product.id);

  const variantCountByProductId = new Map<string, number>();
  if (productIds.length > 0) {
    const variantsRes = await supabase
      .schema("val_dev")
      .from("catalog_product_variants")
      .select("product_id")
      .eq("tenant_id", tenantId)
      .in("product_id", productIds)
      .eq("is_active", true);

    if (variantsRes.error) {
      return NextResponse.json({ error: variantsRes.error.message }, { status: 500 });
    }

    for (const variant of variantsRes.data ?? []) {
      const current = variantCountByProductId.get(variant.product_id) ?? 0;
      variantCountByProductId.set(variant.product_id, current + 1);
    }
  }

  return NextResponse.json<CatalogResponse>({
    scope: "category",
    tenantId,
    nodes: products.map((product) => ({
      type: "product",
      id: product.id,
      name: product.name,
      brand: product.brand,
      variantCount: variantCountByProductId.get(product.id) ?? 0,
    })),
  });
}

async function getGroupNodes({
  supabase,
  tenantId,
  groupId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  groupId: string;
}) {
  const groupItemsRes = await supabase
    .schema("val_dev")
    .from("catalog_product_group_items")
    .select("item_type, item_id")
    .eq("tenant_id", tenantId)
    .eq("group_id", groupId)
    .order("sort_order", { ascending: true });

  if (groupItemsRes.error) {
    return NextResponse.json({ error: groupItemsRes.error.message }, { status: 500 });
  }

  const groupItems = groupItemsRes.data ?? [];
  const productIds = groupItems.filter((item) => item.item_type === "product").map((item) => item.item_id);
  const variantIds = groupItems.filter((item) => item.item_type === "variant").map((item) => item.item_id);

  const [productsRes, variantsRes] = await Promise.all([
    productIds.length > 0
      ? supabase
          .schema("val_dev")
          .from("catalog_products")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    variantIds.length > 0
      ? supabase
          .schema("val_dev")
          .from("catalog_product_variants")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .in("id", variantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsRes.error) {
    return NextResponse.json({ error: productsRes.error.message }, { status: 500 });
  }

  if (variantsRes.error) {
    return NextResponse.json({ error: variantsRes.error.message }, { status: 500 });
  }

  const productById = new Map((productsRes.data ?? []).map((product) => [product.id, product]));
  const variantById = new Map((variantsRes.data ?? []).map((variant) => [variant.id, variant]));

  const nodes = groupItems
    .map((item) => {
      if (item.item_type === "product") {
        const product = productById.get(item.item_id);
        if (!product) return null;
        return { type: "product", id: product.id, name: product.name, brand: null };
      }

      const variant = variantById.get(item.item_id);
      if (!variant) return null;
      return { type: "variant", id: variant.id, name: variant.name };
    })
    .filter((node): node is Record<string, unknown> => node !== null);

  return NextResponse.json<CatalogResponse>({
    scope: "group",
    tenantId,
    nodes,
  });
}
