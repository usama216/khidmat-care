import { HowItWorksPage } from "@/components/pages/InfoPages";
import { en } from "@/content/en";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "en", path: "/how-it-works/", ...en.pages.howItWorks });

export default function Page() {
  return <HowItWorksPage t={en} />;
}
