"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { useStaffNotifications } from "@/hooks/useStaffNotifications";
import {
  loadNotificationSoundEnabled,
  loadNotificationVolume,
  saveNotificationSoundEnabled,
  saveNotificationVolume,
} from "@/lib/admin/notification-sound";
import { staffPanelRootFromPathname } from "@/lib/admin/notificationNavigation";

type StaffNotificationsContextValue = ReturnType<typeof useStaffNotifications> & {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  soundVolume: number;
  setSoundVolume: (v: number) => void;
};

const StaffNotificationsContext = createContext<StaffNotificationsContextValue | null>(null);

export function StaffNotificationsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const staffRoot = staffPanelRootFromPathname(pathname);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [soundVolume, setSoundVolumeState] = useState(10);

  useEffect(() => {
    setSoundEnabledState(loadNotificationSoundEnabled());
    setSoundVolumeState(loadNotificationVolume());
  }, []);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    saveNotificationSoundEnabled(v);
  }, []);

  const setSoundVolume = useCallback((v: number) => {
    setSoundVolumeState(v);
    saveNotificationVolume(v);
  }, []);

  const notifications = useStaffNotifications({
    siteSlug: "gpt-store",
    staffRoot,
    soundEnabled,
    soundVolume,
  });

  const value = useMemo(
    () => ({
      ...notifications,
      soundEnabled,
      setSoundEnabled,
      soundVolume,
      setSoundVolume,
    }),
    [notifications, soundEnabled, setSoundEnabled, soundVolume, setSoundVolume],
  );

  return (
    <StaffNotificationsContext.Provider value={value}>{children}</StaffNotificationsContext.Provider>
  );
}

export function useStaffNotificationsContext(): StaffNotificationsContextValue {
  const ctx = useContext(StaffNotificationsContext);
  if (!ctx) {
    throw new Error("useStaffNotificationsContext must be used within StaffNotificationsProvider");
  }
  return ctx;
}
