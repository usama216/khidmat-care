import { Mail, MapPin, Phone } from "lucide-react";
import { serviceIds, type Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { findPhysioPath, linkPath, localePath, servicePath } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { Logo } from "@/components/ui/Logo";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { EmergencyNotice } from "./EmergencyNotice";

export function Footer({ t }: { t: Dictionary }) {
  const f = t.footer;
  const year = new Date().getFullYear();
  const link = (path: string) => localePath(t.locale, path);
  const pages = [...t.nav.links.slice(0, 1), { href: findPhysioPath, label: t.nav.find }, ...t.nav.links.slice(1), { href: "/for-physiotherapists/", label: t.nav.physios }];
  // Legal pages exist in English only, so they keep the English path from every language.
  const legal = [
    { href: "/terms/", label: f.terms },
    { href: "/privacy/", label: f.privacy },
    { href: "/physio-agreement/", label: f.physioAgreement },
  ];

  return (
    <footer className="bg-stone-950 pt-16 pb-28 text-stone-300 lg:pb-12">
      <div className="shell">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.8fr_0.9fr_0.8fr_1.25fr]">
          <div>
            <Logo href={link("/")} inverted />
            <p className="mt-4 max-w-xs text-stone-400">{f.tagline}</p>
          </div>

          <nav aria-label={t.services.eyebrow}>
            <p className="text-sm font-semibold text-white">{t.nav.links[0]?.label}</p>
            <ul className="mt-4 space-y-2.5">
              {serviceIds.map((id) => (
                <li key={id}>
                  <a href={link(servicePath(id))} className="transition hover:text-white">
                    {t.services.items[id].title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={f.explore}>
            <p className="text-sm font-semibold text-white">{f.explore}</p>
            <ul className="mt-4 space-y-2.5">
              {pages.slice(1).map((page) => (
                <li key={page.href}>
                  <a href={linkPath(t.locale, page.href)} className="transition hover:text-white">
                    {page.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={f.legal}>
            <p className="text-sm font-semibold text-white">{f.legal}</p>
            <ul className="mt-4 space-y-2.5">
              {legal.map((page) => (
                <li key={page.href}>
                  <a href={page.href} hrefLang="en" className="transition hover:text-white">
                    {page.label}
                  </a>
                </li>
              ))}
            </ul>
            {f.englishOnly ? <p className="mt-3 text-xs text-stone-400">{f.englishOnly}</p> : null}
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
              <li>
                <a
                  href={`mailto:${site.supportEmail}`}
                  className="inline-flex items-center gap-2.5 transition hover:text-white"
                >
                  <Mail className="size-4.5 shrink-0 text-brand-400" aria-hidden="true" />
                  <span lang="en" dir="ltr" className="font-sans text-sm">
                    {site.supportEmail.split("@")[0]}@<wbr />{site.supportEmail.split("@")[1]}
                  </span>
                </a>
              </li>
              <li className="inline-flex items-center gap-2.5">
                <MapPin className="size-4.5 shrink-0 text-brand-400" aria-hidden="true" />
                {f.location}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12">
          <EmergencyNotice t={t} tone="dark" />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-8 text-sm text-stone-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <span lang="en">{year}</span> {f.rights}
          </p>
          <p>{f.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
