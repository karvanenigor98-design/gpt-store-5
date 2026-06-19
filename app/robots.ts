import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/app-url";

const BASE_URL = getPublicSiteOrigin();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/favicon.ico", "/favicon.svg", "/icons/"],
        disallow: ["/admin/", "/api/", "/dashboard/", "/cabinet/", "/checkout/"],
      },
      {
        userAgent: "Yandex",
        allow: ["/", "/favicon.ico", "/favicon.svg", "/icons/"],
        disallow: ["/admin/", "/api/", "/dashboard/", "/cabinet/", "/checkout/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
