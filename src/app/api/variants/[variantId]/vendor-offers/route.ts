import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ variantId: string }> }
) {
  const { variantId } = await context.params;
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const offersRes = await supabase
    .schema("val_dev")
    .from("catalog_variant_vendor_prices")
    .select("id, vendor_id, vendor_sku, price, currency_code, min_order_qty, lead_time_days, effective_from, effective_to")
    .eq("tenant_id", tenantId)
    .eq("variant_id", variantId)
    .eq("is_active", true)
    .lte("effective_from", nowIso)
    .or(`effective_to.is.null,effective_to.gte.${nowIso}`)
    .order("price", { ascending: true });

  if (offersRes.error) {
    return NextResponse.json({ error: offersRes.error.message }, { status: 500 });
  }

  const offers = offersRes.data ?? [];
  const vendorIds = [...new Set(offers.map((offer) => offer.vendor_id))];

  const vendorsRes =
    vendorIds.length > 0
      ? await supabase
          .schema("val_dev")
          .from("catalog_vendors")
          .select("id, name, code")
          .eq("tenant_id", tenantId)
          .in("id", vendorIds)
      : { data: [], error: null };

  if (vendorsRes.error) {
    return NextResponse.json({ error: vendorsRes.error.message }, { status: 500 });
  }

  const vendorById = new Map((vendorsRes.data ?? []).map((vendor) => [vendor.id, vendor]));

  return NextResponse.json({
    tenantId,
    variantId,
    offers: offers.map((offer) => ({
      id: offer.id,
      vendor: vendorById.get(offer.vendor_id) ?? null,
      vendorSku: offer.vendor_sku,
      price: offer.price,
      currencyCode: offer.currency_code,
      minOrderQty: offer.min_order_qty,
      leadTimeDays: offer.lead_time_days,
      effectiveFrom: offer.effective_from,
      effectiveTo: offer.effective_to,
    })),
  });
}
