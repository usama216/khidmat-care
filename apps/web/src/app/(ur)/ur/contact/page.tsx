import { ContactPage } from "@/components/pages/InfoPages";
import { ur } from "@/content/ur";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "ur", path: "/contact/", ...ur.pages.contact });

export default function Page() {
  return <ContactPage t={ur} />;
}
