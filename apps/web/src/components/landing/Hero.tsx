import { ArrowRight, ArrowDown, BadgeCheck, Banknote, Check, UserRound } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

export function Hero({ t }: { t: Dictionary }) {
  const h = t.hero;
  return (
    <section className="relative isolate overflow-hidden">
      <Backdrop />
      <div className="shell grid grid-cols-1 items-center gap-16 pt-10 pb-24 sm:pt-16 lg:grid-cols-[1.08fr_1fr] lg:gap-12 lg:pt-20 lg:pb-32">
        <div>
          <p className="inline-flex items-center gap-2.5 rounded-full bg-white/80 py-1.5 ps-2 pe-4 text-sm font-semibold text-brand-800 shadow-sm ring-1 ring-brand-100 backdrop-blur">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-70" />
              <span className="relative inline-flex size-2.5 rounded-full bg-brand-500" />
            </span>
            {h.eyebrow}
          </p>

          <h1 className="mt-7 text-[2.65rem] leading-[1.04] font-semibold tracking-[-0.035em] text-balance text-stone-900 sm:text-6xl lg:text-[4.4rem] ur:text-[2.4rem] ur:sm:text-[3.3rem] ur:lg:text-[3.6rem]">
            {h.titleStart}{" "}
            <span className="relative inline-block text-brand-700">
              {h.titleHighlight}
              <svg
                aria-hidden="true"
                viewBox="0 0 300 20"
                preserveAspectRatio="none"
                className="absolute inset-x-0 -bottom-2 h-3 w-full text-accent-400 ur:-bottom-1"
              >
                <path
                  d="M3 14c50-8 100-11 150-9 49 2 96 6 144 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-lg text-pretty text-stone-600 sm:text-xl sm:leading-relaxed">{h.subtitle}</p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href={whatsappUrl(h.whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("primary", "lg", "group")}
            >
              <WhatsAppIcon className="size-[1.35rem]" />
              {h.primary}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </a>
            <a href="/find/" className={buttonClasses("secondary", "lg")}>
              {h.findPhysio}
              <ArrowDown className="size-5 -rotate-90 rtl:rotate-90" />
            </a>
          </div>
          <p className="mt-4 text-sm text-stone-500">{h.note}</p>

          <ul className="mt-12 grid max-w-lg grid-cols-1 gap-x-6 gap-y-3.5 min-[420px]:grid-cols-2">
            {h.chips.map((chip) => (
              <li key={chip} className="flex items-center gap-2.5 text-[0.95rem] font-medium text-stone-700">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <HeroVisual t={t} />
      </div>
    </section>
  );
}

function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-40 start-[-10%] size-[38rem] rounded-full bg-brand-200/50 blur-3xl" />
      <div className="absolute top-20 end-[-15%] size-[34rem] rounded-full bg-accent-300/25 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(rgba(23,99,87,0.18) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
}

// An illustrated product preview: what a family sees during treatment. Decorative only.
function HeroVisual({ t }: { t: Dictionary }) {
  const m = t.hero.mock;
  const points: [number, number][] = [
    [12, 22],
    [104, 32],
    [196, 52],
    [288, 62],
  ];

  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[28rem] lg:me-0 lg:max-w-[30rem]">
      <div className="absolute -inset-5 -rotate-3 rounded-[2.75rem] bg-linear-to-br from-brand-100 via-sand-100 to-white ring-1 ring-brand-100/60" />
      <div className="absolute -inset-5 rotate-2 rounded-[2.75rem] bg-white/40 ring-1 ring-white" />

      <div className="relative rounded-[2rem] bg-white p-6 shadow-[0_40px_90px_-35px_rgba(7,38,34,0.45)] ring-1 ring-stone-900/5 sm:p-7">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-400 to-brand-700 text-white shadow-lg shadow-brand-700/25">
            <UserRound className="size-7" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-stone-500">{m.yourPhysio}</p>
            <p className="leading-snug font-semibold text-stone-900">{m.role}</p>
          </div>
          <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand-100">
            <BadgeCheck className="size-4" />
            {m.verified}
          </span>
        </div>

        <div className="mt-6 rounded-2xl bg-sand-50 p-4 ring-1 ring-sand-200/60">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-stone-800">{m.session}</span>
            <span className="font-bold text-brand-700" lang="en">
              40%
            </span>
          </div>
          <div className="mt-3 flex gap-1.5" dir="ltr">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < 4 ? "h-2 flex-1 rounded-full bg-brand-600" : "h-2 flex-1 rounded-full bg-stone-200"} />
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl p-4 ring-1 ring-stone-200/70">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-500">{m.painLabel}</span>
            <span className="flex items-center gap-1.5 text-2xl font-bold text-stone-900" dir="ltr" lang="en">
              8
              <ArrowRight className="size-5 text-stone-400" />
              <span className="text-brand-700">4</span>
            </span>
          </div>
          <svg viewBox="0 0 300 100" className="mt-3 h-24 w-full overflow-visible">
            <defs>
              <linearGradient id="pain-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#289a82" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#289a82" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[25, 50, 75].map((y) => (
              <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#e7e5e4" strokeDasharray="3 5" />
            ))}
            <path d="M12 22 C 45 24, 70 30, 104 32 S 165 48, 196 52 S 255 61, 288 62 L288 100 L12 100 Z" fill="url(#pain-fill)" />
            <path
              d="M12 22 C 45 24, 70 30, 104 32 S 165 48, 196 52 S 255 61, 288 62"
              fill="none"
              stroke="#1a7c6a"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {points.map(([x, y], i) => (
              <circle
                key={x}
                cx={x}
                cy={y}
                r={i === points.length - 1 ? 6 : 4}
                fill="#fff"
                stroke="#1a7c6a"
                strokeWidth="3"
              />
            ))}
          </svg>
        </div>
      </div>

      <div className="absolute -top-6 end-0 flex animate-float items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.25)] ring-1 ring-stone-900/5 sm:-end-8">
        <span className="relative flex size-3">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-brand-500" />
        </span>
        <div>
          <p className="text-sm font-bold text-stone-900">{m.onTheWay}</p>
          <p className="text-xs text-stone-500">{m.eta}</p>
        </div>
      </div>

      <div className="absolute -bottom-8 start-0 flex animate-float items-center gap-3 rounded-2xl bg-brand-950 px-4 py-3 text-white shadow-[0_20px_40px_-15px_rgba(7,38,34,0.6)] [animation-delay:-3.5s] sm:-start-8">
        <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-accent-300">
          <Banknote className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold">{m.price}</p>
          <p className="text-xs text-white/70">{m.priceNote}</p>
        </div>
      </div>
    </div>
  );
}
