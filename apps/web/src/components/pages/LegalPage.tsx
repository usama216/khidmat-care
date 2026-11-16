import { Mail } from "lucide-react";
import type { LegalDocument } from "@/content/legal";
import { legalDocuments } from "@/content/legal";
import { en } from "@/content/en";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";
import { PageHero } from "@/components/site/blocks";
import { SiteShell } from "@/components/site/SiteShell";

/** A legal document, readable on a phone, with links to the other legal pages. English only. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const t = en;
  return (
    <SiteShell t={t} path={doc.path} translated={false}>
      <PageHero t={t} crumbs={[{ label: doc.title, path: doc.path }]} title={doc.title} lead={doc.intro}>
        <p className="text-sm text-stone-500">Last updated: {doc.updated}</p>
      </PageHero>
      <div className="shell grid grid-cols-1 gap-12 py-16 lg:grid-cols-[1fr_16rem] lg:gap-16">
        <article className="max-w-3xl space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold text-stone-900">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-relaxed text-stone-700">
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="mt-3 list-disc space-y-2 ps-6 leading-relaxed text-stone-700 marker:text-brand-600">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          <section className="rounded-2xl bg-white p-6 ring-1 ring-stone-200/80">
            <h2 className="text-lg font-semibold text-stone-900">Contact</h2>
            <p className="mt-2 text-stone-700">
              Khidmat Care, Lahore, Pakistan. Email{" "}
              <a href={`mailto:${site.supportEmail}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                <Mail className="size-4" aria-hidden="true" />
                {site.supportEmail}
              </a>{" "}
              or call <a href={`tel:${site.phone}`} className="font-semibold text-brand-700 hover:underline">{site.phoneDisplay}</a>.
            </p>
          </section>
        </article>
        <nav aria-label="Legal" className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-sm font-semibold text-stone-900">Legal</p>
          <ul className="mt-3 space-y-1">
            {legalDocuments.map((other) => (
              <li key={other.path}>
                <a
                  href={other.path}
                  aria-current={other.path === doc.path ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition",
                    other.path === doc.path
                      ? "bg-brand-50 font-semibold text-brand-800"
                      : "text-stone-600 hover:bg-white hover:text-stone-900",
                  )}
                >
                  {other.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </SiteShell>
  );
}
