import { serviceIds, type Locale } from "@/content/types";

/** Adds the language prefix: "/services/" stays as is in English and becomes "/ur/services/". */
export function localePath(locale: Locale, path: string) {
  return locale === "en" ? path : `/ur${path}`;
}

export function servicePath(id: string) {
  return `/services/${id}/`;
}

// Public pages that exist in both languages, in the order they appear in the sitemap.
export const bilingualPaths = [
  "/",
  "/services/",
  ...serviceIds.map(servicePath),
  "/how-it-works/",
  "/for-physiotherapists/",
  "/faq/",
  "/about/",
  "/contact/",
];

// Legal pages are in English only for now.
export const englishOnlyPaths = ["/terms/", "/privacy/", "/physio-agreement/"];
