import { ContactPage } from "@/components/pages/InfoPages";
import { en } from "@/content/en";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "en", path: "/contact/", ...en.pages.contact });

export default function Page() {
  return <ContactPage t={en} />;
}
