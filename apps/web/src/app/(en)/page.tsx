import { HomePage } from "@/components/pages/HomePage";
import { en } from "@/content/en";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "en", path: "/", ...en.pages.home });

export default function Page() {
  return <HomePage t={en} />;
}
