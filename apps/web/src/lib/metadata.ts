import type { Metadata, Viewport } from "next";
import { site } from "@/config/site";
import type { Dictionary } from "@/content/types";

export function buildMetadata(t: Dictionary): Metadata {
  const path = t.locale === "en" ? "/" : "/ur/";
  return {
    metadataBase: new URL(site.url),
    title: t.meta.title,
    description: t.meta.description,
    alternates: {
      canonical: path,
      languages: { en: "/", ur: "/ur/", "x-default": "/" },
    },
    openGraph: {
      type: "website",
      url: path,
      siteName: site.name,
      title: t.meta.title,
      description: t.meta.description,
      locale: t.locale === "en" ? "en_PK" : "ur_PK",
    },
    twitter: { card: "summary", title: t.meta.title, description: t.meta.description },
    icons: { icon: "/favicon.svg" },
    robots: site.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf9f5",
  width: "device-width",
  initialScale: 1,
};
