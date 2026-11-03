import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <rect width="40" height="40" rx="12" className="fill-brand-700" />
      <path
        d="M11 19.6 20 12l9 7.6V28a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2v-8.4Z"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M20 19.4v6.2M16.9 22.5h6.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href, className, inverted }: { href: string; className?: string; inverted?: boolean }) {
  return (
    <a href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Khidmat Care">
      <LogoMark className="size-9 transition-transform duration-300 group-hover:-rotate-6" />
      <span
        lang="en"
        className={cn(
          "font-sans text-[1.15rem] font-bold tracking-tight",
          inverted ? "text-white" : "text-stone-900",
        )}
      >
        Khidmat<span className={inverted ? "text-brand-300" : "text-brand-600"}>Care</span>
      </span>
    </a>
  );
}
