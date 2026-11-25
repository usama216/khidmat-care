"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Percent, Wallet } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { apiGet } from "@/lib/api";
import { track } from "@/lib/analytics";
import { formatPkr } from "@/lib/format";
import { buttonClasses } from "@/components/ui/button";

type Terms = { commission_bps: number | null; minimum_balance_pkr: number };

/**
 * The commission and minimum balance, read live from the dashboard settings so this page never
 * promises a rate the team has since changed. Shows general wording until they load.
 */
export function PhysioTerms({ t }: { t: Dictionary }) {
  const p = t.physioPage;
  const [terms, setTerms] = useState<Terms | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<Terms>("/catalog/physio-terms")
      .then((value) => active && setTerms(value))
      .catch(() => undefined); // The general wording stays, which is still true.
    return () => {
      active = false;
    };
  }, []);

  const keep = terms?.commission_bps != null ? 100 - terms.commission_bps / 100 : null;
  // Whole percentages read better, e.g. "80%" rather than "80.0%".
  const keepText = keep === null ? p.keepFallback : p.keepTemplate.replace("{keep}", String(Number(keep.toFixed(2))));

  // The minimum balance card appears only once the real amount is known.
  return (
    <div className={terms ? "grid grid-cols-1 gap-5 sm:grid-cols-2" : "grid grid-cols-1 gap-5"}>
      <TermCard icon={<Percent className="size-6" aria-hidden="true" />} title={keepText} desc={p.commissionNote} highlight />
      {terms ? (
        <TermCard
          icon={<Wallet className="size-6" aria-hidden="true" />}
          title={formatPkr(terms.minimum_balance_pkr)}
          desc={p.minimumTemplate.replace("{amount}", formatPkr(terms.minimum_balance_pkr))}
        />
      ) : null}
    </div>
  );
}

function TermCard({ icon, title, desc, highlight }: { icon: ReactNode; title: string; desc: string; highlight?: boolean }) {
  return (
    <div
      className={
        highlight
          ? "rounded-[1.75rem] bg-brand-900 p-7 text-white shadow-[0_40px_80px_-40px_rgba(10,47,51,0.7)]"
          : "rounded-[1.75rem] bg-white p-7 ring-1 ring-stone-200/80"
      }
    >
      <span
        className={
          highlight
            ? "grid size-12 place-items-center rounded-2xl bg-white/10 text-brand-200"
            : "grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"
        }
      >
        {icon}
      </span>
      <p className={highlight ? "mt-6 text-2xl font-semibold" : "mt-6 text-2xl font-semibold text-stone-900"}>{title}</p>
      <p className={highlight ? "mt-2 leading-relaxed text-brand-100/85" : "mt-2 leading-relaxed text-stone-600"}>
        {desc}
      </p>
    </div>
  );
}

/** "Apply now", reported to the ads pixel as a lead before going to sign-up. */
export function ApplyLink({ label, size = "lg", light }: { label: string; size?: "md" | "lg"; light?: boolean }) {
  return (
    <a
      href="/register/?role=physio"
      onClick={() => track("Lead", { content_name: "physiotherapist" })}
      className={buttonClasses(light ? "light" : "primary", size)}
    >
      {label}
    </a>
  );
}
