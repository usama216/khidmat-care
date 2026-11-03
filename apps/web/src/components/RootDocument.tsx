import type { ReactNode } from "react";
import type { Dictionary } from "@/content/types";
import { jakarta, nastaliq } from "@/lib/fonts";
import { cn } from "@/lib/cn";

// The `js` class lets CSS hide scroll-reveal content only when JavaScript is running.
const enableJs = "document.documentElement.classList.add('js')";

export function RootDocument({ t, children }: { t: Dictionary; children: ReactNode }) {
  return (
    <html
      lang={t.locale}
      dir={t.dir}
      className={cn(jakarta.variable, t.locale === "ur" && nastaliq.variable)}
      suppressHydrationWarning
    >
      {/* This rule targets the Pages Router; <head> in an App Router root layout is supported. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: enableJs }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
