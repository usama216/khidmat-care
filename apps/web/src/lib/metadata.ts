import type { Metadata, Viewport } from "next";
import { site } from "@/config/site";
import type { Dictionary, Locale } from "@/content/types";
import { localePath } from "./routes";

/** Defaults for every page in a language. Each page then sets its own title and links. */
export function buildMetadata(t: Dictionary): Metadata {
  return {
    metadataBase: new URL(site.url),
    title: t.meta.title,
    description: t.meta.description,
    icons: { icon: "/favicon.svg" },
    robots: site.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}

/**
 * Title, description, canonical link and language alternates for one page.
 * `path` has no language prefix, e.g. "/services/stroke/".
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  bilingual = true,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  bilingual?: boolean;
}): Metadata {
  const url = localePath(locale, path);
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: bilingual ? { en: path, ur: localePath("ur", path), "x-default": path } : undefined,
    },
    openGraph: {
      type: "website",
      url,
      siteName: site.name,
      title,
      description,
      locale: locale === "en" ? "en_PK" : "ur_PK",
    },
    twitter: { card: "summary", title, description },
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf9f5",
  width: "device-width",
  initialScale: 1,
};
