import { ServicesIndexPage } from "@/components/pages/ServicePages";
import { en } from "@/content/en";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "en", path: "/services/", ...en.pages.services });

export default function Page() {
  return <ServicesIndexPage t={en} />;
}
