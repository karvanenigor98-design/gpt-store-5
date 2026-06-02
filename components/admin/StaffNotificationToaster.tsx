"use client";

import { Toaster } from "sonner";

/** Глобальный toast для staff-панелей (админка / оператор). */
export function StaffNotificationToaster() {
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
