"use client";

import * as React from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  depth: number;
  is_leaf: boolean;
};

type Product = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
};

type Variant = {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  is_default: boolean;
};

type AttributeDef = {
  id: string;
  name: string;
  code: string;
  options: Array<{ label: string; value: string }>;
};

type ApiError = { error?: string };

type VariantAttrRow = {
  id: string;
  code: string;
  name: string;
  value: string;
};

type EditingAttribute = {
  id: string;
  name: string;
  code: string;
  optionsCsv: string;
} | null;

export default function CatalogManagePage() {
  const [tenantId, setTenantId] = React.useState(DEFAULT_TENANT_ID);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [variants, setVariants] = React.useState<Variant[]>([]);
  const [attributes, setAttributes] = React.useState<AttributeDef[]>([]);

  const [categoryName, setCategoryName] = React.useState("");
  const [categoryParentId, setCategoryParentId] = React.useState("");

  const [productName, setProductName] = React.useState("");
  const [productCategoryId, setProductCategoryId] = React.useState("");
  const [productBrand, setProductBrand] = React.useState("");
  const [productUom, setProductUom] = React.useState("");

  const [newAttrName, setNewAttrName] = React.useState("");
  const [newAttrCode, setNewAttrCode] = React.useState("");
  const [newAttrOptions, setNewAttrOptions] = React.useState("");
  const [editingAttribute, setEditingAttribute] = React.useState<EditingAttribute>(null);

  const [variantProductId, setVariantProductId] = React.useState("");
  const [variantName, setVariantName] = React.useState("");
  const [variantSku, setVariantSku] = React.useState("");
  const [variantPrice, setVariantPrice] = React.useState("");
  const [variantCurrency, setVariantCurrency] = React.useState("USD");
  const [variantPackSize, setVariantPackSize] = React.useState("");
  const [variantUom, setVariantUom] = React.useState("");
  const [isDefaultVariant, setIsDefaultVariant] = React.useState(false);
  const [variantAttrs, setVariantAttrs] = React.useState<VariantAttrRow[]>([
    { id: "row-1", code: "", name: "", value: "" },
  ]);
  const rowCounterRef = React.useRef(2);

  const leafCategories = categories.filter((c) => c.is_leaf);

  React.useEffect(() => {
    void refreshAll(DEFAULT_TENANT_ID);
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "content-type": "application/json" },
      ...init,
    });
    const payload = (await response.json()) as T | ApiError;
    if (!response.ok) {
      throw new Error((payload as ApiError).error ?? "Request failed");
    }
    return payload as T;
  }

  async function refreshAll(nextTenantId: string) {
    setLoading(true);
    setMessage(null);
    try {
      const [catRes, prodRes, varRes, attrRes] = await Promise.all([
        fetchJson<{ categories: Category[] }>(`/api/catalog-categories?tenantId=${encodeURIComponent(nextTenantId)}`),
        fetchJson<{ products: Product[] }>(`/api/catalog-products?tenantId=${encodeURIComponent(nextTenantId)}`),
        fetchJson<{ variants: Variant[] }>(`/api/catalog-variants?tenantId=${encodeURIComponent(nextTenantId)}`),
        fetchJson<{ attributes: AttributeDef[] }>(`/api/catalog-attributes?tenantId=${encodeURIComponent(nextTenantId)}`),
      ]);
      setCategories(catRes.categories);
      setProducts(prodRes.products);
      setVariants(varRes.variants);
      setAttributes(attrRes.attributes);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load catalog data.");
    } finally {
      setLoading(false);
    }
  }

  async function createCategory() {
    if (!categoryName.trim()) return;
    setMessage(null);
    try {
      await fetchJson("/api/catalog-categories", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          name: categoryName.trim(),
          parentId: categoryParentId || null,
        }),
      });
      setCategoryName("");
      await refreshAll(tenantId);
      setMessage("Category created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create category.");
    }
  }

  async function createProduct() {
    if (!productName.trim() || !productCategoryId) return;
    setMessage(null);
    try {
      await fetchJson("/api/catalog-products", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          name: productName.trim(),
          categoryId: productCategoryId,
          brand: productBrand.trim() || null,
          defaultUom: productUom.trim() || null,
        }),
      });
      setProductName("");
      setProductBrand("");
      setProductUom("");
      await refreshAll(tenantId);
      setMessage("Product created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create product.");
    }
  }

  async function createAttribute() {
    if (!newAttrName.trim()) return;
    const options = newAttrOptions
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    setMessage(null);
    try {
      await fetchJson("/api/catalog-attributes", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          name: newAttrName.trim(),
          code: newAttrCode.trim() || undefined,
          options,
        }),
      });
      setNewAttrName("");
      setNewAttrCode("");
      setNewAttrOptions("");
      await refreshAll(tenantId);
      setMessage("Attribute saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save attribute.");
    }
  }

  async function updateAttribute() {
    if (!editingAttribute) return;
    if (!editingAttribute.name.trim() || !editingAttribute.code.trim()) return;

    const options = editingAttribute.optionsCsv
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    setMessage(null);
    try {
      await fetchJson("/api/catalog-attributes", {
        method: "PATCH",
        body: JSON.stringify({
          tenantId,
          attributeId: editingAttribute.id,
          name: editingAttribute.name.trim(),
          code: editingAttribute.code.trim(),
          options,
        }),
      });
      setEditingAttribute(null);
      await refreshAll(tenantId);
      setMessage("Attribute updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update attribute.");
    }
  }

  async function createVariant() {
    if (!variantProductId || !variantName.trim()) return;

    const payloadAttrs = variantAttrs
      .map((row) => ({
        code: row.code.trim(),
        name: row.name.trim() || row.code.trim(),
        value: row.value.trim(),
      }))
      .filter((row) => row.code && row.value);

    setMessage(null);
    try {
      await fetchJson("/api/catalog-variants", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          productId: variantProductId,
          name: variantName.trim(),
          sku: variantSku.trim() || undefined,
          price: variantPrice.trim() ? Number(variantPrice) : null,
          currencyCode: variantCurrency.trim() || null,
          packSize: variantPackSize.trim() ? Number(variantPackSize) : null,
          uom: variantUom.trim() || null,
          isDefault: isDefaultVariant,
          attributes: payloadAttrs,
        }),
      });
      setVariantName("");
      setVariantSku("");
      setVariantPrice("");
      setVariantPackSize("");
      setVariantUom("");
      setIsDefaultVariant(false);
      setVariantAttrs([{ id: "row-1", code: "", name: "", value: "" }]);
      rowCounterRef.current = 2;
      await refreshAll(tenantId);
      setMessage("Variant created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create variant.");
    }
  }

  function addVariantAttrRow() {
    const nextId = `row-${rowCounterRef.current}`;
    rowCounterRef.current += 1;
    setVariantAttrs((prev) => [...prev, { id: nextId, code: "", name: "", value: "" }]);
  }

  function removeVariantAttrRow(id: string) {
    setVariantAttrs((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev));
  }

  function updateVariantAttrRow(id: string, patch: Partial<VariantAttrRow>) {
    setVariantAttrs((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function handleAttrCodeChange(id: string, code: string) {
    const match = attributes.find((attr) => attr.code === code);
    updateVariantAttrRow(id, {
      code,
      name: match?.name ?? code,
    });
  }

  function getOptionsForCode(code: string) {
    const match = attributes.find((attr) => attr.code === code);
    return match?.options ?? [];
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-emerald-500/10 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Catalog Builder</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create categories, products, attributes/options, and dynamic variants in `val_dev`.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value.trim())}
            placeholder="Tenant UUID"
            className="max-w-md bg-background/80"
          />
          <Button variant="outline" disabled={loading} onClick={() => void refreshAll(tenantId || DEFAULT_TENANT_ID)}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Create Category</CardTitle>
            <CardDescription>Parent is optional. Empty means root category.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" />
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={categoryParentId}
              onChange={(e) => setCategoryParentId(e.target.value)}
            >
              <option value="">No parent (root)</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.path}
                </option>
              ))}
            </select>
            <Button className="w-full" onClick={() => void createCategory()}>
              Save Category
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Create Product</CardTitle>
            <CardDescription>Products must be assigned to a leaf category.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product name" />
            <Input value={productBrand} onChange={(e) => setProductBrand(e.target.value)} placeholder="Brand (optional)" />
            <Input value={productUom} onChange={(e) => setProductUom(e.target.value)} placeholder="Default UOM (optional)" />
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={productCategoryId}
              onChange={(e) => setProductCategoryId(e.target.value)}
            >
              <option value="">Select leaf category</option>
              {leafCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.path}
                </option>
              ))}
            </select>
            <Button className="w-full" onClick={() => void createProduct()}>
              Save Product
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Create Attribute + Options</CardTitle>
            <CardDescription>Example: `Color` with options `Red,Green,Blue`.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={newAttrName} onChange={(e) => setNewAttrName(e.target.value)} placeholder="Attribute name (e.g. Color)" />
            <Input value={newAttrCode} onChange={(e) => setNewAttrCode(e.target.value)} placeholder="Attribute code (optional, e.g. color)" />
            <Input
              value={newAttrOptions}
              onChange={(e) => setNewAttrOptions(e.target.value)}
              placeholder="Options CSV (e.g. Red, Green, Blue)"
            />
            <Button className="w-full" onClick={() => void createAttribute()}>
              Save Attribute
            </Button>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Current attributes</p>
              <div className="max-h-40 space-y-1 overflow-auto text-xs">
                {attributes.map((attr) => (
                  <button
                    key={attr.id}
                    type="button"
                    className="block w-full rounded border px-2 py-1 text-left hover:bg-muted/60"
                    onClick={() =>
                      setEditingAttribute({
                        id: attr.id,
                        name: attr.name,
                        code: attr.code,
                        optionsCsv: attr.options.map((o) => o.label).join(", "),
                      })
                    }
                  >
                    <span className="font-medium">{attr.name}</span> ({attr.code}) -{" "}
                    {attr.options.map((o) => o.label).join(", ") || "no options"}
                  </button>
                ))}
              </div>
            </div>
            {editingAttribute && (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Edit selected attribute</p>
                <div className="space-y-2">
                  <Input
                    value={editingAttribute.name}
                    onChange={(e) =>
                      setEditingAttribute((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                    placeholder="Attribute name"
                  />
                  <Input
                    value={editingAttribute.code}
                    onChange={(e) =>
                      setEditingAttribute((prev) => (prev ? { ...prev, code: e.target.value } : prev))
                    }
                    placeholder="Attribute code"
                  />
                  <Input
                    value={editingAttribute.optionsCsv}
                    onChange={(e) =>
                      setEditingAttribute((prev) => (prev ? { ...prev, optionsCsv: e.target.value } : prev))
                    }
                    placeholder="Options CSV"
                  />
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => void updateAttribute()}>
                      Save Changes
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditingAttribute(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Create Variant (Dynamic Attributes)</CardTitle>
            <CardDescription>Use any attribute code and any option value. New values become options automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={variantProductId}
              onChange={(e) => setVariantProductId(e.target.value)}
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="Variant name" />
              <Input value={variantSku} onChange={(e) => setVariantSku(e.target.value)} placeholder="SKU (optional)" />
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} placeholder="Price" />
              <Input value={variantCurrency} onChange={(e) => setVariantCurrency(e.target.value)} placeholder="Currency" />
              <Input value={variantPackSize} onChange={(e) => setVariantPackSize(e.target.value)} placeholder="Pack size" />
              <Input value={variantUom} onChange={(e) => setVariantUom(e.target.value)} placeholder="UOM" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDefaultVariant} onChange={(e) => setIsDefaultVariant(e.target.checked)} />
              Set as default variant
            </label>

            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Attributes</p>
                <Button type="button" size="sm" variant="outline" onClick={addVariantAttrRow}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Row
                </Button>
              </div>
              <datalist id="attribute-code-list">
                {attributes.map((attr) => (
                  <option key={attr.id} value={attr.code}>
                    {attr.name}
                  </option>
                ))}
              </datalist>
              {variantAttrs.map((row) => (
                <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <Input
                    list="attribute-code-list"
                    value={row.code}
                    onChange={(e) => handleAttrCodeChange(row.id, e.target.value)}
                    placeholder="code (e.g. color)"
                  />
                  <Input value={row.name} onChange={(e) => updateVariantAttrRow(row.id, { name: e.target.value })} placeholder="name (e.g. Color)" />
                  <div>
                    <Input
                      list={`attr-options-${row.id}`}
                      value={row.value}
                      onChange={(e) => updateVariantAttrRow(row.id, { value: e.target.value })}
                      placeholder="value (e.g. Red)"
                    />
                    <datalist id={`attr-options-${row.id}`}>
                      {getOptionsForCode(row.code).map((opt) => (
                        <option key={`${row.id}-${opt.value}`} value={opt.label} />
                      ))}
                    </datalist>
                  </div>
                  <Button type="button" variant="outline" onClick={() => removeVariantAttrRow(row.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={() => void createVariant()}>
              Save Variant
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Categories ({categories.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-1 overflow-auto text-sm">
            {categories.map((category) => (
              <div key={category.id} className="rounded-lg border px-3 py-2">
                <p className="font-medium">{category.name}</p>
                <p className="text-xs text-muted-foreground">{category.path}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Products ({products.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-1 overflow-auto text-sm">
            {products.map((product) => (
              <div key={product.id} className="rounded-lg border px-3 py-2">
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">Slug: {product.slug}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Variants ({variants.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-1 overflow-auto text-sm">
            {variants.map((variant) => (
              <div key={variant.id} className="rounded-lg border px-3 py-2">
                <p className="font-medium">{variant.name}</p>
                <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
