import { NextResponse } from "next/server";

import { syncProfileRoleForUser } from "@/lib/auth/syncProfileRole";
import { syncSubsProfileRoleForUser } from "@/lib/auth/subsProfileSync";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export async function POST(request: Request) {
  const target =
    request.headers.get("x-auth-site") === "subs-store" ? "subs-store" : "gpt-store";

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (target === "subs-store") {
    const subsSession = await createSubsAuthServerClient();
    const subsAdmin = createSubsStoreAdminClient();

    let userId: string | null = null;
    let userEmail: string | null = null;

    if (subsSession) {
      const {
        data: { user: cookieUser },
      } = await subsSession.auth.getUser();
      if (cookieUser) {
        userId = cookieUser.id;
        userEmail = cookieUser.email ?? null;
      }
    }

    if (!userId && token && subsAdmin) {
      const { data: tokenUserData } = await subsAdmin.auth.getUser(token);
      if (tokenUserData.user) {
        userId = tokenUserData.user.id;
        userEmail = tokenUserData.user.email ?? null;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const role = await syncSubsProfileRoleForUser(userId, userEmail);
      return NextResponse.json({ role });
    } catch {
      return NextResponse.json({ error: "Failed to sync subs role" }, { status: 500 });
    }
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  let userId: string | null = null;
  let userEmail: string | null = null;

  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();

  if (cookieUser) {
    userId = cookieUser.id;
    userEmail = cookieUser.email ?? null;
  } else if (token) {
    const { data: tokenUserData } = await admin.auth.getUser(token);
    if (tokenUserData.user) {
      userId = tokenUserData.user.id;
      userEmail = tokenUserData.user.email ?? null;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const role = await syncProfileRoleForUser(userId, userEmail);
    return NextResponse.json({ role });
  } catch {
    return NextResponse.json({ error: "Failed to sync role" }, { status: 500 });
  }
}
