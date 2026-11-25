import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { bilingualPaths, englishOnlyPaths, localePath } from "@/lib/routes";

// When the public pages last changed. Update it with the content: search engines ignore dates
// that move on every deploy.
const CONTENT_UPDATED = "2026-11-25";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [];
  for (const path of bilingualPaths) {
    const en = `${site.url}${path}`;
    const ur = `${site.url}${localePath("ur", path)}`;
    const entry = { lastModified: CONTENT_UPDATED, alternates: { languages: { en, ur, "x-default": en } } };
    pages.push({ url: en, ...entry }, { url: ur, ...entry });
  }
  for (const path of englishOnlyPaths) pages.push({ url: `${site.url}${path}`, lastModified: CONTENT_UPDATED });
  return pages;
}
