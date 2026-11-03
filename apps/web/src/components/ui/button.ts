import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "light" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2.5 rounded-full whitespace-nowrap font-semibold transition duration-200 select-none active:scale-[0.98] disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-700 text-white shadow-[0_10px_30px_-10px_rgba(23,99,87,0.7)] hover:bg-brand-800 hover:shadow-[0_14px_34px_-10px_rgba(23,99,87,0.8)]",
  secondary: "bg-white text-stone-900 ring-1 ring-stone-300/80 hover:ring-stone-400 hover:bg-stone-50",
  light: "bg-white text-brand-900 hover:bg-brand-50",
  ghost: "text-stone-700 hover:bg-stone-900/5",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-7 text-base sm:text-[1.05rem]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}
