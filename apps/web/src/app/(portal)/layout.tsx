import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { jakarta } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { default: "Khidmat Care", template: "%s | Khidmat Care" },
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
  width: "device-width",
  initialScale: 1,
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="bg-stone-50 text-[0.9375rem]">
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
