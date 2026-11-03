import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { en: `${site.url}/`, ur: `${site.url}/ur/` };
  return [
    { url: `${site.url}/`, alternates: { languages } },
    { url: `${site.url}/ur/`, alternates: { languages } },
  ];
}
