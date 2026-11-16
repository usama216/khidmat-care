import { FaqPage } from "@/components/pages/InfoPages";
import { ur } from "@/content/ur";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "ur", path: "/faq/", ...ur.pages.faq });

export default function Page() {
  return <FaqPage t={ur} />;
}
