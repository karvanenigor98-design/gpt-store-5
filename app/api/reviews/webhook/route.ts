import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyNewReview } from "@/lib/telegram/notifications";

type TelegramMessage = {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  chat?: { id?: number | string };
  from?: { first_name?: string; last_name?: string; username?: string };
};

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    if (
      process.env.TELEGRAM_WEBHOOK_SECRET &&
      secret !== process.env.TELEGRAM_WEBHOOK_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const update = (await request.json()) as {
      message?: TelegramMessage;
      channel_post?: TelegramMessage;
    };
    const message = update.message ?? update.channel_post;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const reviewsGroupId =
      process.env.TELEGRAM_REVIEWS_GROUP_ID ?? process.env.TELEGRAM_REVIEWS_CHAT_ID;
    if (reviewsGroupId && String(message.chat?.id) !== reviewsGroupId) {
      return NextResponse.json({ ok: true });
    }

    const text = message.text ?? message.caption ?? "";
    if (!text || text.length < 10) {
      return NextResponse.json({ ok: true });
    }

    const authorName =
      [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") ||
      "Аноним";

    const mediaUrls: string[] = [];
    const supabase = createAdminClient();

    const { data: review, error } = await supabase
      .from("reviews")
      .upsert(
        {
          telegram_message_id: message.message_id,
          telegram_chat_id: typeof message.chat?.id === "number" ? message.chat.id : null,
          author_name: authorName,
          author_username: message.from?.username ?? null,
          content: text,
          media_urls: mediaUrls,
          telegram_date: new Date(message.date * 1000).toISOString(),
          status: "pending",
        },
        { onConflict: "telegram_message_id" }
      )
      .select()
      .single();

    if (!error && review) {
      await notifyNewReview(review);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Reviews Webhook]", err);
    return NextResponse.json({ ok: true });
  }
}
