import type { ReactNode } from "react";
import { ChevronRight, Phone } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";
import { localePath } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

/** Search engines read this to understand the page. Values are escaped against script injection. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export type Crumb = { label: string; path: string };

/** Visible breadcrumbs plus the matching BreadcrumbList for search results. */
export function Breadcrumbs({ t, items }: { t: Dictionary; items: Crumb[] }) {
  const all: Crumb[] = [{ label: t.nav.home, path: "/" }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
          {all.map((crumb, index) => {
            const last = index === all.length - 1;
            return (
              <li key={crumb.path} className="inline-flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="font-medium text-stone-700">
                    {crumb.label}
                  </span>
                ) : (
                  <>
                    <a href={localePath(t.locale, crumb.path)} className="transition hover:text-stone-900">
                      {crumb.label}
                    </a>
                    <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.label,
            item: `${site.url}${localePath(t.locale, crumb.path)}`,
          })),
        }}
      />
    </>
  );
}

/** The opening of an inner page: breadcrumbs, a heading and an optional lead and actions. */
export function PageHero({
  t,
  crumbs,
  eyebrow,
  title,
  lead,
  children,
}: {
  t: Dictionary;
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-stone-200/70">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_-10%,var(--color-brand-100),transparent_70%),radial-gradient(40rem_24rem_at_0%_0%,var(--color-sand-100),transparent_70%)]"
      />
      <div className="shell py-12 sm:py-16 lg:py-20">
        <Breadcrumbs t={t} items={crumbs} />
        {eyebrow ? (
          <p className="mt-8 text-sm font-semibold tracking-wide text-brand-700 uppercase ur:normal-case ur:tracking-normal">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "max-w-3xl text-[2.3rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-stone-900 sm:text-5xl ur:text-[2.1rem] ur:leading-[1.5] ur:sm:text-[2.6rem]",
            eyebrow ? "mt-3" : "mt-8",
          )}
        >
          {title}
        </h1>
        {lead ? <p className="mt-6 max-w-2xl text-lg text-pretty text-stone-600 sm:text-xl sm:leading-relaxed">{lead}</p> : null}
        {children ? <div className="mt-9">{children}</div> : null}
      </div>
    </section>
  );
}

/** WhatsApp and phone buttons used at the top and bottom of pages. */
export function ContactButtons({ t, message, className }: { t: Dictionary; message?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row", className)}>
      <a
        href={whatsappUrl(message ?? t.hero.whatsappMessage)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses("primary", "lg")}
      >
        <WhatsAppIcon className="size-[1.35rem]" />
        {t.nav.cta}
      </a>
      <a href={`tel:${site.phone}`} className={buttonClasses("secondary", "lg")}>
        <Phone className="size-5" aria-hidden="true" />
        <span lang="en" dir="ltr" className="font-sans">
          {site.phoneDisplay}
        </span>
      </a>
    </div>
  );
}

/** A closing call to action in the brand colour. */
export function CtaBand({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="py-20 sm:py-24">
      <div className="shell">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-900 px-8 py-14 text-center sm:px-14">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(40rem_20rem_at_50%_-20%,rgba(95,224,205,0.25),transparent_70%)]"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl ur:leading-[1.5]">
              {title}
            </h2>
            <p className="mt-4 text-lg text-brand-100/85">{desc}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
