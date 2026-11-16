import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { bilingualPaths, englishOnlyPaths, localePath } from "@/lib/routes";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [];
  for (const path of bilingualPaths) {
    const languages = { en: `${site.url}${path}`, ur: `${site.url}${localePath("ur", path)}` };
    pages.push({ url: languages.en, alternates: { languages } }, { url: languages.ur, alternates: { languages } });
  }
  for (const path of englishOnlyPaths) pages.push({ url: `${site.url}${path}` });
  return pages;
}
