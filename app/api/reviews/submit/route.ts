import { NextRequest, NextResponse } from "next/server";

import { insertCustomerReview } from "@/lib/reviews/insert-customer-review";
import { notifyReviewSubmitted } from "@/lib/reviews/notify-review-submitted";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";

export async function POST(req: NextRequest) {
  let body: {
    site?: "gpt-store" | "subs-store";
    content?: string;
    rating?: number;
    author_name?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const site = body.site === "subs-store" ? "subs-store" : "gpt-store";
  const content = body.content?.trim() ?? "";
  const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating) || 0)));
  const guestName = body.author_name?.trim() ?? "";

  if (content.length < 10) {
    return NextResponse.json({ error: "Отзыв слишком короткий (минимум 10 символов)" }, { status: 400 });
  }
  if (!rating) {
    return NextResponse.json({ error: "Укажите оценку от 1 до 5" }, { status: 400 });
  }

  const { browserLike: supabase } = await createSiteSessionClient(site);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let authorName = guestName;
  let authorUsername: string | null = null;

  if (user) {
    if (site === "subs-store") {
      authorName =
        (user.user_metadata?.username as string | undefined)?.trim() ||
        user.email?.split("@")[0] ||
        guestName ||
        "Клиент";
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, email")
        .eq("id", user.id)
        .maybeSingle();
      authorUsername = profile?.username ?? null;
      authorName =
        profile?.username?.trim() || user.email?.split("@")[0] || guestName || "Клиент";
    }
  } else if (authorName.length < 2) {
    return NextResponse.json(
      {
        error: "Укажите имя в форме или войдите в аккаунт",
        needAuth: true,
      },
      { status: 401 },
    );
  }

  const inserted = await insertCustomerReview({
    site,
    authorName,
    authorUsername,
    content,
    rating,
    userId: user?.id ?? null,
  });

  if (!inserted.ok) {
    const status = inserted.code === "subs_db_missing" ? 503 : 500;
    return NextResponse.json({ error: inserted.error, code: inserted.code }, { status });
  }

  await notifyReviewSubmitted({
    siteSlug: site,
    reviewId: inserted.id,
    authorName,
    content,
  }).catch((err) => console.error("[reviews/submit] notify:", err));

  return NextResponse.json({ ok: true, id: inserted.id, status: "pending", site });
}
