import type { Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { localePath } from "@/lib/routes";
import { organization } from "@/lib/schema";
import { BookSection } from "@/components/landing/BookSection";
import { Faq } from "@/components/landing/Faq";
import { Families } from "@/components/landing/Families";
import { ForPhysios } from "@/components/landing/ForPhysios";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Services } from "@/components/landing/Services";
import { WhyUs } from "@/components/landing/WhyUs";
import { JsonLd } from "@/components/site/blocks";
import { SiteShell } from "@/components/site/SiteShell";

export function HomePage({ t }: { t: Dictionary }) {
  return (
    <SiteShell t={t} path="/">
      <Hero t={t} />
      <Services t={t} />
      <HowItWorks t={t} more />
      <WhyUs t={t} />
      <Families t={t} />
      <BookSection t={t} />
      <ForPhysios t={t} />
      <Faq t={t} limit={5} seeAll />
      <JsonLd data={organization(t)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: site.name,
          url: `${site.url}${localePath(t.locale, "/")}`,
          inLanguage: t.locale,
          publisher: { "@id": `${site.url}/#organization` },
        }}
      />
    </SiteShell>
  );
}
