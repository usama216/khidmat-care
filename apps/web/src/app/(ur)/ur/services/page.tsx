import { ServicesIndexPage } from "@/components/pages/ServicePages";
import { ur } from "@/content/ur";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "ur", path: "/services/", ...ur.pages.services });

export default function Page() {
  return <ServicesIndexPage t={ur} />;
}
