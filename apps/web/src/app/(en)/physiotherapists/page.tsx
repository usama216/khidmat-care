import { FindPhysioPage } from "@/components/pages/FindPhysioPages";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  locale: "en",
  path: "/physiotherapists/",
  title: "Find a physiotherapist in Lahore | Book home physiotherapy",
  description:
    "Verified physiotherapists for home visits across Lahore. Compare fees, experience and ratings, and book a free time from their calendar.",
  bilingual: false,
});

export default function Page() {
  return <FindPhysioPage />;
}
