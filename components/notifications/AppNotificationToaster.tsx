"use client";

import { Toaster } from "sonner";

/** Sonner для клиентского кабинета (уведомления, отзывы). */
export function AppNotificationToaster() {
  return (
    <Toaster
      position="top-right"
      expand
      richColors={false}
      closeButton={false}
      toastOptions={{
        classNames: {
          toast: "p-0 border-0 bg-transparent shadow-none",
        },
      }}
    />
  );
}
