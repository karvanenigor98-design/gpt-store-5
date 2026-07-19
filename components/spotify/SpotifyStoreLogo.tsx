import { cn } from "@/lib/utils";

type SpotifyStoreLogoProps = {
  /** Visual scale hint (keeps nav/footer sizing familiar). */
  height?: number;
  className?: string;
  priority?: boolean;
  /** denser mark for tight slots (nav). */
  compact?: boolean;
};

/** Compact SVG mark + text wordmark. No raster icon. */
export function SpotifyStoreLogo({
  height = 38,
  className,
  compact = false,
}: SpotifyStoreLogoProps) {
  const size = height <= 32 ? "sm" : height >= 48 ? "lg" : "md";
  const iconPx = size === "sm" ? 18 : size === "lg" ? 28 : 22;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center select-none",
        compact ? "gap-2" : "gap-2.5",
        className,
      )}
      aria-label="SPOTIFY STORE"
    >
      <svg
        width={iconPx}
        height={iconPx}
        viewBox="0 0 24 24"
        className="shrink-0"
        aria-hidden
      >
        <circle cx="12" cy="12" r="12" fill="#1DB954" />
        <path
          fill="#0a0a0a"
          d="M16.9 16.7c-.2.3-.6.4-.9.2-2.5-1.5-5.7-1.9-9.4-1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4.1-.9 7.6-.5 10.4 1.2.3.1.4.6.2.9zm1.3-2.9c-.3.4-.7.5-1.1.3-2.9-1.8-7.3-2.3-10.7-1.2-.4.1-.9-.1-1-.6-.1-.4.1-.9.5-1 3.9-1.2 8.8-.6 12.1 1.4.4.2.5.7.2 1.1zm.1-3c-3.4-2-9.1-2.2-12.4-1.2-.5.2-1.1-.1-1.2-.7-.2-.5.1-1.1.7-1.2 3.8-1.1 10.1-.9 14.1 1.4.5.3.6.9.4 1.4-.3.4-.9.5-1.4.3z"
        />
      </svg>
      <span
        className={cn(
          "font-heading font-bold uppercase leading-none tracking-[0.12em]",
          size === "sm" && "text-[11px]",
          size === "md" && "text-[13px] sm:text-sm",
          size === "lg" && "text-base sm:text-lg",
        )}
      >
        <span className="text-white">SPOTIFY</span>
        <span className="hidden text-[#1DB954] min-[380px]:inline"> STORE</span>
      </span>
    </span>
  );
}
