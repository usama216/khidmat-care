import { HomePage } from "@/components/pages/HomePage";
import { ur } from "@/content/ur";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ locale: "ur", path: "/", ...ur.pages.home });

export default function Page() {
  return <HomePage t={ur} />;
}
