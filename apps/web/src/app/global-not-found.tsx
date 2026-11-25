import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { buttonClasses } from "@/components/ui/button";
import { LogoImage } from "@/components/ui/Logo";
import { jakarta } from "@/lib/fonts";
import { icons } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Page not found | Khidmat Home Care",
  robots: { index: false, follow: true },
  icons,
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <main className="grid min-h-dvh place-items-center p-6 text-center">
          <div>
            <Link href="/" className="inline-flex">
              <LogoImage className="h-10" />
            </Link>
            <h1 className="mt-10 text-3xl font-semibold tracking-tight text-stone-900">This page doesn&apos;t exist</h1>
            <p className="mt-3 text-stone-600">The link may be old or mistyped.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/" className={buttonClasses("primary", "md")}>
                Go to the home page
              </Link>
              <Link href="/physiotherapists/" className={buttonClasses("secondary", "md")}>
                Find a physiotherapist
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
