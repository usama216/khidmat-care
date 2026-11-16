import { PhysioLandingPage } from "@/components/pages/PhysioPage";
import { en } from "@/content/en";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "en", path: "/for-physiotherapists/", ...en.pages.physios });

export default function Page() {
  return <PhysioLandingPage t={en} />;
}
