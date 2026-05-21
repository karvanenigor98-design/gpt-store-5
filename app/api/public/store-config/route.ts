import { NextResponse } from "next/server";
import { CHATGPT_PLANS } from "@/lib/chatgpt-data";
import { getStoreConfig, type StoreConfig } from "@/lib/store-config";
import { withTimeout } from "@/lib/server/withTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FALLBACK_CONFIG: StoreConfig = {
  plans: [...CHATGPT_PLANS.plus, ...CHATGPT_PLANS.pro],
  promoCodes: [],
  landingSections: { showReviews: true, showFaq: true, showCompare: true },
  landingDiscounts: [],
};

export async function GET() {
  const config = await withTimeout(getStoreConfig(), 4000, FALLBACK_CONFIG);
  return NextResponse.json({
    plans: config.plans,
    promoCodes: config.promoCodes,
    landingSections: config.landingSections,
    landingDiscounts: config.landingDiscounts,
  });
}
