import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  if (!site.allowIndexing) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    // Signed-in areas have nothing for search engines and shouldn't appear in results.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/physio/", "/my/", "/book/", "/login/", "/register/"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
