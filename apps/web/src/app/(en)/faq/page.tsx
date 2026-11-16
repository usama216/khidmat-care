import { FaqPage } from "@/components/pages/InfoPages";
import { en } from "@/content/en";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "en", path: "/faq/", ...en.pages.faq });

export default function Page() {
  return <FaqPage t={en} />;
}
