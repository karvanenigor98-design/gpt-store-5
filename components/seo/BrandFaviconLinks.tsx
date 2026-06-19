import { headers } from "next/headers";
import {
  buildSiteIconsMetadata,
  resolveSiteIconSlugFromHost,
} from "@/lib/brand/site-icons";

/** Explicit absolute favicon links for Yandex favicon bot (in addition to metadata.icons). */
export async function BrandFaviconLinks() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const pathname = h.get("x-invoke-pathname") ?? "";
  const site = resolveSiteIconSlugFromHost(host, pathname);
  const icons = buildSiteIconsMetadata(site);

  const iconList = icons.icon;

  return (
    <>
      {iconList.map((item) => (
        <link
          key={item.url}
          rel={item.rel ?? "icon"}
          href={item.url}
          {...(item.type ? { type: item.type } : {})}
          {...(item.sizes ? { sizes: item.sizes } : {})}
        />
      ))}
    </>
  );
}
