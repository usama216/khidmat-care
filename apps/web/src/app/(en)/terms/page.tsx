import { LegalPage } from "@/components/pages/LegalPage";
import { terms } from "@/content/legal";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  locale: "en",
  path: terms.path,
  title: `${terms.title} | Khidmat Home Care`,
  description: terms.description,
  bilingual: false,
});

export default function Page() {
  return <LegalPage doc={terms} />;
}
