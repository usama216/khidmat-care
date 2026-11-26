import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { icons } from "@/lib/metadata";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { GoogleTagManager, GoogleTagManagerNoScript } from "@/components/GoogleTagManager";
import { MetaPixel } from "@/components/MetaPixel";
import { jakarta } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { default: "Khidmat Home Care", template: "%s | Khidmat Home Care" },
  robots: { index: false, follow: false },
  icons,
};

export const viewport: Viewport = {
  themeColor: "#f7f9fb",
  width: "device-width",
  initialScale: 1,
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="bg-stone-50 text-[0.9375rem]">
        <GoogleTagManagerNoScript />
        <AdminProviders>{children}</AdminProviders>
        <GoogleTagManager />
        <MetaPixel />
      </body>
    </html>
  );
}
