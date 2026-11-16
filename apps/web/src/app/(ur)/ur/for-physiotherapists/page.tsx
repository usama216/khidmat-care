import { PhysioLandingPage } from "@/components/pages/PhysioPage";
import { ur } from "@/content/ur";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "ur", path: "/for-physiotherapists/", ...ur.pages.physios });

export default function Page() {
  return <PhysioLandingPage t={ur} />;
}
