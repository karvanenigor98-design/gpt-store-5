"use client";

import {
  CheckCircle2,
  CreditCard,
  Mail,
  Rocket,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { ChatLandingIconKey } from "@/lib/chatgpt-data";

export const CHAT_LANDING_ICONS: Record<ChatLandingIconKey, LucideIcon> = {
  "credit-card": CreditCard,
  mail: Mail,
  rocket: Rocket,
  sparkles: Sparkles,
  shield: Shield,
  "check-circle-2": CheckCircle2,
};

export function chatLandingLucideIcon(key: ChatLandingIconKey): LucideIcon {
  return CHAT_LANDING_ICONS[key] ?? CreditCard;
}
