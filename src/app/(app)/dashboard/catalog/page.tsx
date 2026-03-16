"use client";

import * as React from "react";
import { RefreshCw, ShoppingCart, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type CatalogNode = {
  type: "group" | "category" | "product" | "variant";
  id: string;
  name: string;
  depth?: number;
  hasChildren?: boolean;
  variantCount?: number;
  brand?: string | null;
};

type CatalogNodesResponse = {
  scope: "root" | "category" | "group";
  tenantId: string;
  nodes: CatalogNode[];
};

type ProductVariant = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  sku: string;
  price: number | null;
  currencyCode: string | null;
  packSize: number | null;
  uom: string | null;
  isDefault: boolean;
  attributes: Array<{
    attributeId: string;
    code: string;
    name: string;
    value: string;
  }>;
};

type CategoryVariantsResponse = {
  tenantId: string;
  categoryId: string;
  variants: ProductVariant[];
};

type VendorOffer = {
  id: string;
  vendor: { id: string; name: string; code: string } | null;
  vendorSku: string | null;
  price: number;
  currencyCode: string;
  minOrderQty: number;
  leadTimeDays: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
};

type VendorOffersResponse = {
  tenantId: string;
  variantId: string;
  offers: VendorOffer[];
};

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

export default function CatalogWorkspacePage() {
  const [tenantId, setTenantId] = React.useState(DEFAULT_TENANT_ID);

  const [topCategories, setTopCategories] = React.useState<CatalogNode[]>([]);
  const [selectedParentCategoryId, setSelectedParentCategoryId] = React.useState<string | null>(null);

  const [leafCards, setLeafCards] = React.useState<CatalogNode[]>([]);
  const [leafLoading, setLeafLoading] = React.useState(true);
  const [leafError, setLeafError] = React.useState<string | null>(null);

  const [selectedLeaf, setSelectedLeaf] = React.useState<CatalogNode | null>(null);
  const [variants, setVariants] = React.useState<ProductVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = React.useState(false);
  const [variantAttributeSelections, setVariantAttributeSelections] = React.useState<
    Record<string, string>
  >({});

  const [selectedVariant, setSelectedVariant] = React.useState<ProductVariant | null>(null);
  const [offers, setOffers] = React.useState<VendorOffer[]>([]);
  const [offersLoading, setOffersLoading] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);

  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    void loadTopCategories(DEFAULT_TENANT_ID);
    void loadLeafCards(DEFAULT_TENANT_ID, null, "");
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!tenantId) return;
    startTransition(() => {
      void loadLeafCards(tenantId, selectedParentCategoryId, deferredSearch);
    });
    // Search-driven refresh for leaf cards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch]);

  async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json()) as T | { error?: string };

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && "error" in payload
          ? String(payload.error)
          : "Request failed";
      throw new Error(message);
    }

    return payload as T;
  }

  function resetSelection() {
    setSelectedLeaf(null);
    setVariants([]);
    setSelectedVariant(null);
    setOffers([]);
  }

  async function loadTopCategories(nextTenantId: string) {
    const data = await fetchJson<CatalogNodesResponse>(
      `/api/catalog-nodes?tenantId=${encodeURIComponent(nextTenantId)}`
    );

    setTopCategories(data.nodes.filter((node) => node.type === "category"));
  }

  async function loadLeafCards(
    nextTenantId: string,
    parentCategoryId: string | null,
    searchTerm: string
  ) {
    setLeafLoading(true);
    setLeafError(null);

    try {
      const parentParam = parentCategoryId
        ? `&parentCategoryId=${encodeURIComponent(parentCategoryId)}`
        : "";
      const searchParam = searchTerm.trim()
        ? `&search=${encodeURIComponent(searchTerm.trim())}`
        : "";

      const data = await fetchJson<CatalogNodesResponse>(
        `/api/catalog-nodes?tenantId=${encodeURIComponent(nextTenantId)}&leafOnly=true${parentParam}${searchParam}`
      );

      setLeafCards(data.nodes.filter((node) => node.type === "category"));
      resetSelection();
    } catch (error) {
      setLeafError(error instanceof Error ? error.message : "Failed to load deepest categories.");
    } finally {
      setLeafLoading(false);
    }
  }

  async function loadVariantsForLeaf(nextTenantId: string, leaf: CatalogNode) {
    setVariantsLoading(true);

    try {
      const data = await fetchJson<CategoryVariantsResponse>(
        `/api/categories/${encodeURIComponent(leaf.id)}/variants?tenantId=${encodeURIComponent(nextTenantId)}`
      );

      setSelectedLeaf(leaf);
      setVariants(data.variants);

      const defaultVariant = data.variants.find((variant) => variant.isDefault) ?? data.variants[0] ?? null;
      setSelectedVariant(defaultVariant);
      if (defaultVariant) {
        setVariantAttributeSelections(
          Object.fromEntries(defaultVariant.attributes.map((attr) => [attr.code, attr.value]))
        );
        await loadVendorOffers(nextTenantId, defaultVariant.id);
      } else {
        setVariantAttributeSelections({});
        setOffers([]);
      }
    } catch {
      setSelectedLeaf(leaf);
      setVariants([]);
      setSelectedVariant(null);
      setVariantAttributeSelections({});
      setOffers([]);
    } finally {
      setVariantsLoading(false);
    }
  }

  async function loadVendorOffers(nextTenantId: string, variantId: string) {
    setOffersLoading(true);

    try {
      const data = await fetchJson<VendorOffersResponse>(
        `/api/variants/${encodeURIComponent(variantId)}/vendor-offers?tenantId=${encodeURIComponent(nextTenantId)}`
      );
      setOffers(data.offers);
    } catch {
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  }

  const filteredLeafCards = leafCards;

  const bestOffer = offers.length > 0 ? offers[0] : null;
  const variantAttributeFilters = buildVariantAttributeFilters(variants);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-emerald-500/10 p-6">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">
              Product Catalog
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Leaf Category E-Commerce View</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Cards show only deepest categories (for example, Soda). Use parent filter to narrow by higher-level categories.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value.trim())}
              placeholder="Tenant UUID"
              className="h-10 min-w-[280px] bg-background/80"
            />
            <Button
              variant="outline"
              className="h-10"
              disabled={leafLoading || isPending}
              onClick={() => {
                startTransition(() => {
                  void loadTopCategories(tenantId || DEFAULT_TENANT_ID);
                  void loadLeafCards(tenantId || DEFAULT_TENANT_ID, selectedParentCategoryId, search);
                });
              }}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${leafLoading || isPending ? "animate-spin" : ""}`} />
              Refresh Catalog
            </Button>
          </div>
        </div>
      </section>

      <Card className="rounded-3xl border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-base">Parent Category Filter</CardTitle>
          <CardDescription>Optional filter. Cards remain deepest categories only.</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant={selectedParentCategoryId === null ? "default" : "outline"}
              onClick={() => {
                setSelectedParentCategoryId(null);
                startTransition(() => {
                  void loadLeafCards(tenantId, null, search);
                });
              }}
            >
              All Parents
            </Button>
            {topCategories.map((category) => (
              <Button
                key={category.id}
                size="sm"
                variant={selectedParentCategoryId === category.id ? "default" : "outline"}
                onClick={() => {
                  setSelectedParentCategoryId(category.id);
                  startTransition(() => {
                    void loadLeafCards(tenantId, category.id, search);
                  });
                }}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card className="rounded-3xl border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-base">Deepest Category Cards</CardTitle>
            <CardDescription>Click a leaf category card to load variants directly.</CardDescription>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories/products/brands" />
          </CardHeader>

          <CardContent>
            {leafError && (
              <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {leafError}
              </p>
            )}

            {leafLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-36 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : filteredLeafCards.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No deepest categories available for this filter.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredLeafCards.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      void loadVariantsForLeaf(tenantId, node);
                    }}
                    className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-1 hover:shadow-md ${selectedLeaf?.id === node.id
                      ? "border-cyan-500/60 bg-cyan-500/10"
                      : "border-border bg-background hover:border-cyan-500/45"
                      }`}
                  >
                    <p className="text-base font-medium">{node.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Leaf Category</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-3xl border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-base">Variant + Vendor In {selectedLeaf?.name ?? "Leaf Category"}</CardTitle>
              <CardDescription>Choose attribute options, then pick variant and vendor offer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {variantAttributeFilters.length > 0 && (
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Variant Picker (Type / Options)
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {variantAttributeFilters.map((filter) => (
                        <label key={filter.code} className="space-y-1.5">
                          <span className="text-xs text-muted-foreground">{filter.name}</span>
                          <select
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                            value={variantAttributeSelections[filter.code] ?? ""}
                            onChange={(event) => {
                              const nextSelections = {
                                ...variantAttributeSelections,
                                [filter.code]: event.target.value,
                              };
                              setVariantAttributeSelections(nextSelections);

                              const matched = variants.find((variant) =>
                                variant.attributes.every((attr) => {
                                  const selectedValue = nextSelections[attr.code];
                                  return !selectedValue || selectedValue === attr.value;
                                })
                              );

                              if (matched) {
                                setSelectedVariant(matched);
                                void loadVendorOffers(tenantId, matched.id);
                              }
                            }}
                          >
                            <option value="">Any</option>
                            {filter.options.map((option) => (
                              <option key={`${filter.code}-${option}`} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variants</p>
                {variantsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)
                ) : variants.length === 0 ? (
                  <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    {selectedLeaf ? "No variants in this leaf category." : "Select a leaf category first."}
                  </p>
                ) : (
                  variants.map((variant) => {
                    const active = selectedVariant?.id === variant.id;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariant(variant);
                          setVariantAttributeSelections(
                            Object.fromEntries(variant.attributes.map((attr) => [attr.code, attr.value]))
                          );
                          void loadVendorOffers(tenantId, variant.id);
                        }}
                        className={`w-full rounded-2xl border p-3 text-left transition ${active
                          ? "border-orange-500/60 bg-orange-500/10"
                          : "border-border hover:border-orange-500/40"
                          }`}
                      >
                        <p className="text-sm font-medium">{variant.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">SKU: {variant.sku || "N/A"}</p>
                        {variant.attributes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {variant.attributes.map((attr) => (
                              <Badge key={`${variant.id}-${attr.attributeId}`} variant="outline">
                                {attr.name}: {attr.value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor Offers</p>
                {offersLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-18 animate-pulse rounded-2xl bg-muted" />)
                ) : offers.length === 0 ? (
                  <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Select a variant to load vendor offers.
                  </p>
                ) : (
                  offers.map((offer, index) => (
                    <div
                      key={offer.id}
                      className={`rounded-2xl border p-3 ${index === 0 ? "border-orange-500/60 bg-orange-500/10" : "border-border"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <Truck className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                          {offer.vendor?.name ?? "Unknown vendor"}
                        </p>
                        {index === 0 && <Badge>Best</Badge>}
                      </div>
                      <p className="mt-2 text-lg font-semibold">{formatCurrency(offer.price, offer.currencyCode)}</p>
                      <p className="text-xs text-muted-foreground">Min qty: {trimNumber(offer.minOrderQty)}</p>
                      <p className="text-xs text-muted-foreground">
                        Lead time: {offer.leadTimeDays ?? "N/A"} day{offer.leadTimeDays === 1 ? "" : "s"}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              <div className="rounded-2xl bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Selection Summary</p>
                <p className="mt-1 text-sm font-medium">Category: {selectedLeaf?.name ?? "N/A"}</p>
                <p className="text-sm text-muted-foreground">Product: {selectedVariant?.productName ?? "N/A"}</p>
                <p className="text-sm text-muted-foreground">Variant: {selectedVariant?.name ?? "N/A"}</p>
                <p className="text-sm text-muted-foreground">Vendor: {bestOffer?.vendor?.name ?? "N/A"}</p>
                <p className="text-sm text-muted-foreground">
                  Unit price: {bestOffer ? formatCurrency(bestOffer.price, bestOffer.currencyCode) : "N/A"}
                </p>

                <Button className="mt-4 w-full" disabled={!selectedVariant || !bestOffer}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add To Cart
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number | null, currencyCode: string | null) {
  if (value === null || Number.isNaN(value)) return "Price unavailable";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode || "USD"} ${value.toFixed(2)}`;
  }
}

function trimNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toString();
}

function buildVariantAttributeFilters(variants: ProductVariant[]) {
  const byCode = new Map<string, { code: string; name: string; options: Set<string> }>();

  for (const variant of variants) {
    for (const attribute of variant.attributes) {
      const current = byCode.get(attribute.code) ?? {
        code: attribute.code,
        name: attribute.name,
        options: new Set<string>(),
      };

      current.options.add(attribute.value);
      byCode.set(attribute.code, current);
    }
  }

  return [...byCode.values()]
    .map((entry) => ({
      code: entry.code,
      name: entry.name,
      options: [...entry.options].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
