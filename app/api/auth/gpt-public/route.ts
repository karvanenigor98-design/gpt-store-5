import { NextResponse } from "next/server";

import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

export const runtime = "edge";

/** Public anon key — same as NEXT_PUBLIC_*, for login when the client bundle missed it. */
export async function GET() {
  return NextResponse.json({
    url: getGptPublicSupabaseUrl(),
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  });
}
