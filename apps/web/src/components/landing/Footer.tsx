import { MapPin, Phone } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { whatsappUrl } from "@/lib/whatsapp";
import { Logo } from "@/components/ui/Logo";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { EmergencyNotice } from "./EmergencyNotice";

export function Footer({ t }: { t: Dictionary }) {
  const f = t.footer;
  const year = new Date().getFullYear();
  const home = t.locale === "en" ? "/" : "/ur/";

  return (
    <footer className="bg-stone-950 pt-16 pb-28 text-stone-300 lg:pb-12">
      <div className="shell">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.3fr_0.7fr_1fr_1.2fr]">
          <div>
            <Logo href={home} inverted />
            <p className="mt-4 max-w-xs text-stone-400">{f.tagline}</p>
          </div>

          <nav aria-label={f.explore}>
            <p className="text-sm font-semibold text-white">{f.explore}</p>
            <ul className="mt-4 space-y-2.5">
              {[...t.nav.links, { href: "#physios", label: t.nav.physios }].map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-sm font-semibold text-white">{f.contact}</p>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href={whatsappUrl(t.hero.whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 transition hover:text-white"
                >
                  <WhatsAppIcon className="size-5 text-brand-400" />
                  {t.mobileBar.whatsapp}
                </a>
              </li>
              <li>
                <a href={`tel:${site.phone}`} className="inline-flex items-center gap-2.5 transition hover:text-white">
                  <Phone className="size-4.5 text-brand-400" aria-hidden="true" />
                  <span lang="en" dir="ltr" className="font-sans">
                    {site.phoneDisplay}
                  </span>
                </a>
              </li>
              <li className="inline-flex items-center gap-2.5">
                <MapPin className="size-4.5 text-brand-400" aria-hidden="true" />
                {f.location}
              </li>
            </ul>
          </div>

          <EmergencyNotice t={t} tone="dark" />
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-8 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <span lang="en">{year}</span> {f.rights}
          </p>
          <p>{f.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
