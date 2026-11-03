"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

// Always-reachable contact buttons on phones, shown once the hero CTA has scrolled away.
export function MobileBar({ t }: { t: Dictionary }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/80 bg-white/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl transition-transform duration-300 lg:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      inert={!visible}
    >
      <div className="mx-auto grid max-w-md grid-cols-[1fr_auto] gap-3">
        <a
          href={whatsappUrl(t.hero.whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-13 items-center justify-center gap-2.5 rounded-full bg-brand-700 font-semibold text-white shadow-lg shadow-brand-700/25 active:scale-[0.98]"
        >
          <WhatsAppIcon className="size-5" />
          {t.mobileBar.whatsapp}
        </a>
        <a
          href={`tel:${site.phone}`}
          className="flex h-13 items-center justify-center gap-2 rounded-full px-6 font-semibold text-stone-800 ring-1 ring-stone-300 active:scale-[0.98]"
        >
          <Phone className="size-5" aria-hidden="true" />
          {t.mobileBar.call}
        </a>
      </div>
    </div>
  );
}
