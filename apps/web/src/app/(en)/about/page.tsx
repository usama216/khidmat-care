import { AboutPage } from "@/components/pages/InfoPages";
import { en } from "@/content/en";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "en", path: "/about/", ...en.pages.about });

export default function Page() {
  return <AboutPage t={en} />;
}
