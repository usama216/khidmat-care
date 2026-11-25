import { cn } from "@/lib/cn";

// Files in public/brand, made from the original public/khidmat-logo.svg. The tagline is left out:
// at header size it can't be read.

/** The round mark alone, for tight spaces. Decorative: the name is always written next to it. */
export function LogoMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mark.svg" alt="" width={188} height={188} className={className} />;
}

/** Give it a height; the width follows. */
export function LogoImage({ className, inverted }: { className: string; inverted?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={inverted ? "/brand/logo-white.svg" : "/brand/logo.svg"}
      alt="Khidmat Home Care"
      width={1084}
      height={188}
      className={cn("w-auto", className)}
    />
  );
}

export function Logo({ href, className, inverted }: { href: string; className?: string; inverted?: boolean }) {
  return (
    <a href={href} className={cn("inline-flex shrink-0 items-center", className)}>
      <LogoImage inverted={inverted} className="h-7 sm:h-9" />
    </a>
  );
}
