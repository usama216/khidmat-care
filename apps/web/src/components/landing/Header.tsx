"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

export function Header({ t }: { t: Dictionary }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const home = t.locale === "en" ? "/" : "/ur/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300",
        scrolled || open
          ? "border-stone-200/80 bg-sand-50/95 shadow-[0_8px_30px_-20px_rgba(0,0,0,0.25)] backdrop-blur-xl"
          : "border-transparent",
      )}
    >
      <div className="shell flex h-[4.25rem] items-center justify-between gap-4">
        <Logo href={home} />

        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {t.nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-[0.95rem] font-medium text-stone-600 transition hover:bg-stone-900/5 hover:text-stone-900"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#physios"
            className="rounded-full px-4 py-2 text-[0.95rem] font-medium text-stone-600 transition hover:bg-stone-900/5 hover:text-stone-900"
          >
            {t.nav.physios}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={t.nav.switchHref}
            hrefLang={t.nav.switchLang}
            lang={t.nav.switchLang}
            className={cn(
              "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-stone-700 ring-1 ring-stone-300/80 transition hover:bg-white hover:ring-stone-400",
              t.nav.switchLang === "ur" ? "font-urdu text-[0.95rem]" : "font-sans",
            )}
          >
            {t.nav.switchLabel}
          </a>
          <span className="hidden sm:block">
            <a
              href={whatsappUrl(t.hero.whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("primary", "md")}
            >
              <WhatsAppIcon className="size-5" />
              {t.nav.cta}
            </a>
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
            className="grid size-10 place-items-center rounded-full text-stone-800 ring-1 ring-stone-300/80 transition hover:bg-white xl:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className="h-[calc(100dvh-4.25rem)] overflow-y-auto border-t border-stone-200/80 bg-sand-50 xl:hidden"
      >
        <nav aria-label="Mobile" className="shell flex flex-col gap-1 py-6">
          {[...t.nav.links, { href: "#physios", label: t.nav.physios }].map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={close}
              className="rounded-2xl px-4 py-4 text-xl font-semibold text-stone-800 transition hover:bg-white"
            >
              {link.label}
            </a>
          ))}
          <a
            href={whatsappUrl(t.hero.whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className={buttonClasses("primary", "lg", "mt-6 w-full")}
          >
            <WhatsAppIcon className="size-5" />
            {t.nav.cta}
          </a>
        </nav>
      </div>
    </header>
  );
}
