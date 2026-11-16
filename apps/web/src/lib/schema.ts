import { site } from "@/config/site";
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
    description: t.pages.home.description,
    telephone: site.phone,
    email: site.supportEmail,
    areaServed: { "@type": "City", name: "Lahore" },
    address: { "@type": "PostalAddress", addressLocality: "Lahore", addressCountry: "PK" },
    medicalSpecialty: "PhysicalTherapy",
  };
}
