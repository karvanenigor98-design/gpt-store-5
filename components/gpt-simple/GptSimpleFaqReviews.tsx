"use client";

import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLandingReviewsRotation } from "@/hooks/useLandingReviewsRotation";
import { GPT_SIMPLE_FAQ_ITEMS } from "@/lib/chatgpt-data";
import { shouldHideUsername } from "@/lib/reviews/review-sanitize";
import type { PublicReview } from "@/lib/reviews/publicReviews";

function ReviewCard({ review }: { review: PublicReview }) {
  const username = shouldHideUsername(review.authorUsername)
    ? null
    : review.authorUsername?.replace(/^@+/, "");

  return (
    <article className="rounded-2xl border border-black/[0.07] bg-white p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{review.authorName}</p>
          {username ? <p className="truncate text-xs text-gray-500">@{username}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-amber-400">★★★★★</p>
          <p className="text-xs text-gray-400">{review.dateLabel}</p>
        </div>
      </header>
      <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-gray-600">{review.content}</p>
    </article>
  );
}

export function GptSimpleFaqReviews({ reviews }: { reviews: PublicReview[] }) {
  const visible = useLandingReviewsRotation(reviews, 3, 10_000);
  const batchKey = visible.map((review) => review.id).join("|");

  return (
    <section className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-12">
        <div id="faq">
          <h2 className="font-heading text-2xl font-bold text-gray-900">Перед оплатой обычно спрашивают</h2>
          <div className="mt-4 rounded-2xl border border-black/[0.08] bg-gray-50">
            <Accordion type="single" collapsible defaultValue="item-0">
              {GPT_SIMPLE_FAQ_ITEMS.map((item, index) => (
                <AccordionItem
                  key={item.question}
                  value={`item-${index}`}
                  className="border-b border-black/[0.06] last:border-b-0"
                >
                  <AccordionTrigger className="px-4 py-3.5 text-left text-sm text-gray-900 hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3.5 text-sm leading-relaxed text-gray-500">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <div id="reviews">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-heading text-2xl font-bold text-gray-900">Уже подключили — вот что пишут</h2>
            <Link href="/reviews" className="text-sm font-medium text-[#10a37f] hover:underline">
              Смотреть все отзывы →
            </Link>
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-gray-500">Отзывы появятся после публикации в админке.</p>
          ) : (
            <div key={batchKey} className="grid gap-3">
              {visible.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
