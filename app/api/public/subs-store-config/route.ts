import { NextResponse } from "next/server";

import { getSubsStoreConfig } from "@/lib/subs-store-config";
import { withTimeout } from "@/lib/server/withTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const config = await withTimeout(getSubsStoreConfig(), 4000, {
    plans: [],
    landingDiscounts: [],
    promoCodes: [],
    source: "static" as const,
  });

  return NextResponse.json({
    plans: config.plans,
    landingDiscounts: config.landingDiscounts,
    promoCodes: config.promoCodes,
    source: config.source,
  });
}
