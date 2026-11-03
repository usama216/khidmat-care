import { cn } from "@/lib/cn";

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "start" | "center";
  tone?: "light" | "dark";
  className?: string;
};

export function SectionHeading({ eyebrow, title, subtitle, align = "start", tone = "light", className }: Props) {
  const dark = tone === "dark";
  return (
    <div data-reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p
        className={cn(
          "inline-flex items-center gap-2 text-sm font-semibold tracking-wide uppercase ur:normal-case ur:tracking-normal",
          dark ? "text-brand-300" : "text-brand-700",
        )}
      >
        <span className={cn("h-px w-6", dark ? "bg-brand-300/60" : "bg-brand-600/50")} aria-hidden="true" />
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1] ur:text-[1.9rem] ur:sm:text-[2.3rem]",
          dark ? "text-white" : "text-stone-900",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className={cn("mt-5 text-lg text-pretty", dark ? "text-brand-100/80" : "text-stone-600")}>{subtitle}</p>
      ) : null}
    </div>
  );
}
