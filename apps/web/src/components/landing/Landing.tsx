import type { Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { BookSection } from "./BookSection";
import { ContactSection } from "./ContactSection";
import { Faq } from "./Faq";
import { Families } from "./Families";
import { Footer } from "./Footer";
import { ForPhysios } from "./ForPhysios";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { MobileBar } from "./MobileBar";
import { Packages } from "./Packages";
import { RevealObserver } from "./RevealObserver";
import { Services } from "./Services";
import { WhyUs } from "./WhyUs";

export function Landing({ t }: { t: Dictionary }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: site.name,
    url: site.url,
    description: t.meta.description,
    areaServed: { "@type": "City", name: "Lahore" },
    telephone: site.phone,
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-brand-700 px-5 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t.nav.skip}
      </a>
      <Header t={t} />
      <main id="main">
        <Hero t={t} />
        <Services t={t} />
        <HowItWorks t={t} />
        <WhyUs t={t} />
        <Packages t={t} />
        <Families t={t} />
        <BookSection t={t} />
        <ForPhysios t={t} />
        <Faq t={t} />
        <ContactSection t={t} />
      </main>
      <Footer t={t} />
      <MobileBar t={t} />
      <RevealObserver />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
