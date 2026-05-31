"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { SITES, getSiteBySlug, type SiteDefinition } from "@/lib/sites";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin-selected-site-slug";

export function getAdminSelectedSiteSlug(): string {
  if (typeof window === "undefined") return SITES[0].slug;
  try {
    return localStorage.getItem(STORAGE_KEY) ?? SITES[0].slug;
  } catch {
    return SITES[0].slug;
  }
}

export function getAdminSelectedSite(): SiteDefinition {
  const slug = getAdminSelectedSiteSlug();
  return getSiteBySlug(slug);
}

interface Props {
  onSiteChange?: (site: SiteDefinition) => void;
  /** Светлая шапка или тёмный сайдбар оператора */
  variant?: "default" | "sidebar-dark";
  /** Ссылка «Управление магазинами» — только для админа */
  showManageLink?: boolean;
}

export function SiteSwitcher({
  onSiteChange,
  variant = "default",
  showManageLink = true,
}: Props) {
  const [selectedSite, setSelectedSite] = useState<SiteDefinition>(SITES[0]);
  const [open, setOpen] = useState(false);
  const [accessibleSlugs, setAccessibleSlugs] = useState<string[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const isDark = variant === "sidebar-dark";

  const visibleSites = useMemo(() => {
    if (!accessibleSlugs?.length) return SITES;
    const filtered = SITES.filter((s) => accessibleSlugs.includes(s.slug));
    return filtered.length > 0 ? filtered : SITES;
  }, [accessibleSlugs]);

  useEffect(() => {
    void fetch("/api/auth/accessible-admin-sites", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { sites?: string[] }) => {
        const list = Array.isArray(j.sites) && j.sites.length ? j.sites : ["gpt-store"];
        setAccessibleSlugs(list);
      })
      .catch(() => {
        setAccessibleSlugs(["gpt-store"]);
      });
  }, []);

  useEffect(() => {
    const urlSiteSlug = new URLSearchParams(window.location.search).get("site");
    if (urlSiteSlug === "gpt-store" || urlSiteSlug === "subs-store") {
      const fromUrl = getSiteBySlug(urlSiteSlug);
      setSelectedSite(fromUrl);
      try {
        localStorage.setItem(STORAGE_KEY, urlSiteSlug);
      } catch {
        /* noop */
      }
      return;
    }
    const saved = getAdminSelectedSite();
    setSelectedSite(saved);
  }, []);

  useEffect(() => {
    if (!accessibleSlugs?.length) return;
    if (!accessibleSlugs.includes(selectedSite.slug)) {
      const fallback = SITES.find((s) => accessibleSlugs.includes(s.slug)) ?? SITES[0];
      setSelectedSite(fallback);
      try {
        localStorage.setItem(STORAGE_KEY, fallback.slug);
      } catch {}
    }
  }, [accessibleSlugs, selectedSite.slug]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function selectSite(site: SiteDefinition) {
    setSelectedSite(site);
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, site.slug);
    } catch {}
    onSiteChange?.(site);
    // Navigate to current page with ?site= param so server components can filter by site
    const url = new URL(window.location.href);
    url.searchParams.set("site", site.slug);
    window.location.href = url.toString();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
          isDark
            ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
            : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100",
        )}
      >
        <Globe size={14} className={isDark ? "text-gray-400" : "text-gray-500"} />
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: selectedSite.primaryColor }}
        />
        <span className="max-w-[140px] truncate font-medium">{selectedSite.brandName}</span>
        <ChevronDown
          size={12}
          className={cn(
            "ml-auto transition-transform",
            isDark ? "text-gray-400" : "text-gray-500",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Выберите магазин</p>
          </div>
          <ul className="py-1">
            {visibleSites.map((site) => (
              <li key={site.id}>
                <button
                  type="button"
                  onClick={() => selectSite(site)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 ${
                    site.id === selectedSite.id ? "text-gray-900" : "text-gray-600"
                  }`}
                >
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                    style={{ backgroundColor: site.primaryColor }}
                  >
                    {site.logoLetter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{site.brandName}</p>
                    <p className="truncate text-[10px] text-gray-500">{site.description}</p>
                  </div>
                  {site.id === selectedSite.id && (
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#10a37f]" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          {showManageLink && (
            <div className="border-t border-gray-100 px-3 py-2">
              <a href="/admin/sites" className="block text-xs text-gray-500 transition-colors hover:text-gray-700">
                Управление магазинами →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Inline badge showing currently selected site — for use in header */
export function AdminSiteBadge() {
  const [site, setSite] = useState<SiteDefinition>(SITES[0]);

  useEffect(() => {
    setSite(getAdminSelectedSite());
  }, []);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-800"
      style={{ borderColor: site.primaryColor + "55", color: site.primaryColor }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: site.primaryColor }} />
      {site.brandName}
    </span>
  );
}
