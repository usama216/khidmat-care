import type { ReactNode } from "react";
import type { Dictionary } from "@/content/types";
import { localePath } from "@/lib/routes";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { MobileBar } from "@/components/landing/MobileBar";
import { RevealObserver } from "@/components/landing/RevealObserver";

/**
 * The frame around every public page. `path` is the page without the language prefix; when the
 * page has no translation, the language switch leads to the other language's home page.
 */
export function SiteShell({
  t,
  path,
  translated = true,
  children,
}: {
  t: Dictionary;
  path: string;
  translated?: boolean;
  children: ReactNode;
}) {
  const other = t.nav.switchLang;
  const altHref = localePath(other, translated ? path : "/");

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-brand-700 px-5 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t.nav.skip}
      </a>
      <Header t={t} path={path} altHref={altHref} />
      <main id="main">{children}</main>
      <Footer t={t} />
      <MobileBar t={t} />
      <RevealObserver />
    </>
  );
}
