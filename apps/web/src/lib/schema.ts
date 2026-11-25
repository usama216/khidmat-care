import { lahoreAreas, site } from "@/config/site";
import type { Dictionary } from "@/content/types";
import { localePath } from "./routes";

/** The business as search engines should know it, referenced by every page's structured data. */
export function organization(t: Dictionary) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "@id": `${site.url}/#organization`,
    name: site.name,
    url: `${site.url}${localePath(t.locale, "/")}`,
    // The earlier name, so search engines connect the two.
    alternateName: "Khidmat Care",
    logo: { "@type": "ImageObject", url: `${site.url}/brand/icon-512.png`, width: 512, height: 512 },
    image: `${site.url}/og.png`,
    description: t.pages.home.description,
    telephone: site.phone,
    email: site.supportEmail,
    areaServed: [
      { "@type": "City", name: "Lahore" },
      ...lahoreAreas.map((name) => ({ "@type": "Place", name: `${name}, Lahore` })),
    ],
    address: { "@type": "PostalAddress", addressLocality: "Lahore", addressCountry: "PK" },
    medicalSpecialty: "https://schema.org/Physiotherapy",
    currenciesAccepted: "PKR",
    paymentAccepted: "Cash",
    knowsLanguage: ["en", "ur"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: site.phone,
      email: site.supportEmail,
      areaServed: "PK",
      availableLanguage: ["en", "ur"],
    },
  };
}
