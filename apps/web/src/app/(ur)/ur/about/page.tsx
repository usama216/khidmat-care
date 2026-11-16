import { AboutPage } from "@/components/pages/InfoPages";
import { ur } from "@/content/ur";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "ur", path: "/about/", ...ur.pages.about });

export default function Page() {
  return <AboutPage t={ur} />;
}
