import type { Metadata } from "next";
import { Suspense } from "react";

import { CallbackClient } from "./CallbackClient";

export const metadata: Metadata = { title: "Подтверждение" };

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackClient />
    </Suspense>
  );
}
