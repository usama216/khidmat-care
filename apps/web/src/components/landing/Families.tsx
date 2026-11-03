import { CheckCheck, Check, Plane } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/Logo";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

export function Families({ t }: { t: Dictionary }) {
  const f = t.families;
  return (
    <section className="relative isolate overflow-hidden bg-brand-950 py-24 sm:py-32">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute -top-32 start-1/4 size-[36rem] rounded-full bg-brand-700/40 blur-3xl" />
        <div className="absolute -bottom-40 end-0 size-[30rem] rounded-full bg-brand-500/20 blur-3xl" />
      </div>

      <div className="shell grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
        <div>
          <span
            aria-hidden="true"
            className="mb-6 grid size-12 place-items-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/15"
          >
            <Plane className="size-6 rtl:-scale-x-100" />
          </span>
          <SectionHeading eyebrow={f.eyebrow} title={f.title} subtitle={f.desc} tone="dark" />
          <ul data-reveal className="mt-9 space-y-4">
            {f.points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-lg text-white">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-400/20 text-brand-300 ring-1 ring-brand-400/30">
                  <Check className="size-4" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <div data-reveal className="mt-10">
            <a
              href={whatsappUrl(t.hero.whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("light", "lg")}
            >
              <WhatsAppIcon className="size-5 text-brand-700" />
              {f.cta}
            </a>
          </div>
        </div>

        <ChatPreview t={t} />
      </div>
    </section>
  );
}

// A WhatsApp-style preview of what updates look like. Decorative only.
function ChatPreview({ t }: { t: Dictionary }) {
  const chat = t.families.chat;
  return (
    <div data-reveal aria-hidden="true" className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-4 rotate-2 rounded-[2.5rem] bg-white/5 ring-1 ring-white/10" />
      <div className="relative overflow-hidden rounded-[2rem] bg-[#efeae2] shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center gap-3 bg-brand-800 px-5 py-4 text-white">
          <LogoMark className="size-10 rounded-full ring-2 ring-white/20" />
          <div>
            <p className="font-semibold">{chat.name}</p>
            <p className="font-sans text-xs text-white/70" lang="en">
              {chat.status}
            </p>
          </div>
        </div>
        <div
          className="flex flex-col gap-3 p-5"
          style={{
            backgroundImage: "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        >
          {chat.messages.map((msg, i) => {
            const mine = msg.from === "family";
            return (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] text-stone-800 shadow-sm",
                  mine ? "self-end rounded-se-md bg-[#d9fdd3]" : "self-start rounded-ss-md bg-white",
                )}
              >
                <p>{msg.text}</p>
                <p className="mt-1 flex items-center justify-end gap-1 font-sans text-[0.7rem] text-stone-500" lang="en">
                  {msg.time}
                  {mine ? <CheckCheck className="size-3.5 text-sky-500" /> : null}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
