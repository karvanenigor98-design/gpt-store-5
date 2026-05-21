import { revalidatePath } from "next/cache";

/** Сброс кэша страниц, где показываются одобренные отзывы. */
export function revalidatePublicReviewPages(): void {
  revalidatePath("/");
  revalidatePath("/reviews");
  revalidatePath("/spotify");
  revalidatePath("/spotify/reviews");
}
