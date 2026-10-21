import { headers } from "next/headers";
import { Suspense } from "react";

import { AuthChrome } from "./AuthChrome";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const host = headers().get("host") ?? headers().get("x-forwarded-host") ?? "";
  const hostname = host.split(",")[0]?.trim().split(":")[0] ?? "";

  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <AuthChrome hostname={hostname}>{children}</AuthChrome>
    </Suspense>
  );
}
