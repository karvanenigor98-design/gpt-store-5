import { cn } from "@/lib/utils";

type SpotifyStoreLogoProps = {
  /** Visual scale hint (keeps nav/footer sizing familiar). */
  height?: number;
  className?: string;
  priority?: boolean;
  /** denser mark for tight slots (nav). */
  compact?: boolean;
};

/** Text wordmark — no PNG icon. Matches Spotify Store dark/green UI. */
export function SpotifyStoreLogo({
  height = 38,
  className,
  compact = false,
}: SpotifyStoreLogoProps) {
  const size = height <= 32 ? "sm" : height >= 48 ? "lg" : "md";

  return (
    <span
      className={cn(
        "inline-flex items-center select-none",
        compact ? "gap-2" : "gap-2.5",
        className,
      )}
      aria-label="SPOTIFY STORE"
    >
      <span
        className={cn(
          "rounded-full",
          size === "sm" ? "h-1.5 w-1.5" : size === "lg" ? "h-2.5 w-2.5" : "h-2 w-2",
        )}
        style={{
          background: "#1DB954",
          boxShadow: "0 0 12px rgba(29,185,84,0.85)",
        }}
        aria-hidden
      />
      <span
        className={cn(
          "font-heading font-bold uppercase leading-none tracking-[0.12em]",
          size === "sm" && "text-[11px]",
          size === "md" && "text-[13px] sm:text-sm",
          size === "lg" && "text-base sm:text-lg",
        )}
      >
        <span className="text-white">SPOTIFY</span>
        <span style={{ color: "#1DB954" }}> STORE</span>
      </span>
    </span>
  );
}
