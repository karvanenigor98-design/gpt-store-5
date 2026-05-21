import {
  Clock3,
  CreditCard,
  Headphones,
  Music,
  Shield,
  Star,
  type LucideIcon,
} from "lucide-react";

const HOW_ICONS: Record<string, LucideIcon> = {
  music: Music,
  credit_card: CreditCard,
  shield: Shield,
  headphones: Headphones,
};

const PRINCIPLE_ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  credit_card: CreditCard,
  clock3: Clock3,
  headphones: Headphones,
  star: Star,
};

export function spotifyHowItWorksIcon(key: string): LucideIcon {
  return HOW_ICONS[key] ?? Music;
}

export function spotifySafetyPrincipleIcon(key: string): LucideIcon {
  return PRINCIPLE_ICONS[key] ?? Shield;
}
