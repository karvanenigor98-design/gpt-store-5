import Image from "next/image";

const LOGO_SRC = "/icons/spotify/logo.png";
const LOGO_WIDTH = 87;
const LOGO_HEIGHT = 120;

type SpotifyStoreLogoProps = {
  height?: number;
  className?: string;
  priority?: boolean;
};

export function SpotifyStoreLogo({
  height = 38,
  className,
  priority = false,
}: SpotifyStoreLogoProps) {
  const width = Math.round((LOGO_WIDTH / LOGO_HEIGHT) * height);

  return (
    <Image
      src={LOGO_SRC}
      alt="SPOTIFY STORE"
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{ width, height }}
    />
  );
}
