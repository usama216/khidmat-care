import type { CSSProperties } from "react";
import { Banknote, Sparkles } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Packages({ t }: { t: Dictionary }) {
  const p = t.packages;
  return (
    <section id="packages" className="scroll-mt-20 border-y border-stone-200/70 bg-white py-24 sm:py-32">
      <div className="shell">
        <SectionHeading eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} align="center" />

        <ul className="mt-16 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {p.items.map((item, i) => {
            const price = site.packagePrices[item.count];
            const featured = Boolean(item.featured);
            return (
              <li key={item.count} data-reveal style={{ "--reveal-delay": `${i * 80}ms` } as CSSProperties}>
                <article
                  className={cn(
                    "relative flex h-full flex-col rounded-[1.75rem] p-7 transition duration-300",
                    featured
                      ? "bg-brand-900 text-white shadow-[0_40px_80px_-40px_rgba(7,38,34,0.7)] lg:-my-4 lg:h-[calc(100%+2rem)] lg:py-11"
                      : "bg-sand-50 ring-1 ring-stone-200/80 hover:ring-brand-200",
                  )}
                >
                  {featured ? (
                    <span className="absolute -top-3.5 start-7 inline-flex items-center gap-1.5 rounded-full bg-accent-400 px-3 py-1 text-xs font-bold text-brand-950 shadow-md">
                      <Sparkles className="size-3.5" />
                      {p.badge}
                    </span>
                  ) : null}

                  <p className="flex items-baseline gap-2">
                    <span
                      lang="en"
                      className={cn(
                        "font-sans text-5xl font-bold tracking-tight",
                        featured ? "text-white" : "text-stone-900",
                      )}
                    >
                      {item.count}
                    </span>
                    <span className={cn("font-medium", featured ? "text-brand-200" : "text-stone-500")}>
                      {item.count === 1 ? p.session : p.sessions}
                    </span>
                  </p>
                  <h3 className={cn("mt-5 text-lg font-semibold", featured ? "text-white" : "text-stone-900")}>
                    {item.title}
                  </h3>
                  <p className={cn("mt-1.5 flex-1 text-[0.95rem]", featured ? "text-brand-100/80" : "text-stone-600")}>
                    {item.desc}
                  </p>

                  <div className={cn("mt-6 border-t pt-5", featured ? "border-white/15" : "border-stone-200")}>
                    {price ? (
                      <>
                        <p lang="en" className="font-sans text-2xl font-bold">
                          {formatPkr(price)}
                        </p>
                        {item.count > 1 ? (
                          <p className={cn("mt-0.5 text-sm", featured ? "text-brand-200" : "text-stone-500")}>
                            <span lang="en">{formatPkr(price / item.count)}</span> {p.perSession}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className={cn("font-semibold", featured ? "text-brand-100" : "text-stone-700")}>
                        {p.priceOnRequest}
                      </p>
                    )}
                  </div>

                  <a
                    href={whatsappUrl(p.askMessage.replace("{count}", String(item.count)))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses(featured ? "light" : "secondary", "md", "mt-6 w-full")}
                  >
                    {p.cta}
                  </a>
                </article>
              </li>
            );
          })}
        </ul>

        <div
          data-reveal
          className="mx-auto mt-14 flex max-w-2xl flex-col items-center gap-3 text-center text-stone-600 sm:flex-row sm:text-start"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Banknote className="size-5" />
          </span>
          <p>
            <span className="font-semibold text-stone-800">{p.payment}</span> {p.priceNote}
          </p>
        </div>
      </div>
    </section>
  );
}
