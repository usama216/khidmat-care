import { HowItWorksPage } from "@/components/pages/InfoPages";
import { ur } from "@/content/ur";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "ur", path: "/how-it-works/", ...ur.pages.howItWorks });

export default function Page() {
  return <HowItWorksPage t={ur} />;
}
