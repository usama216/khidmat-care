import type { Metadata, Viewport } from "next";
import { site } from "@/config/site";
import type { Dictionary, Locale } from "@/content/types";
import { localePath } from "./routes";

export const icons: Metadata["icons"] = {
  icon: [
    { url: "/favicon.ico", sizes: "48x48" },
    { url: "/favicon.svg", type: "image/svg+xml" },
  ],
  apple: "/apple-touch-icon.png",
};

/** Shown when a page is shared on WhatsApp, Facebook and similar. */
const shareImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Khidmat Home Care: expert physiotherapy at home in Lahore",
};

/** Defaults for every page in a language. Each page then sets its own title and links. */
export function buildMetadata(t: Dictionary): Metadata {
  return {
    metadataBase: new URL(site.url),
    title: t.meta.title,
    description: t.meta.description,
    applicationName: site.name,
    icons,
    // Large previews let Google show the share image and full snippets.
    robots: site.allowIndexing
      ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 }
      : { index: false, follow: false },
    verification: site.googleVerification ? { google: site.googleVerification } : undefined,
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
      images: [shareImage],
    },
    twitter: { card: "summary_large_image", title, description, images: [shareImage.url] },
  };
}

export const viewport: Viewport = {
  themeColor: "#f8fcfb",
  width: "device-width",
  initialScale: 1,
};
