import { LegalPage } from "@/components/pages/LegalPage";
import { privacy } from "@/content/legal";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  locale: "en",
  path: privacy.path,
  title: `${privacy.title} | Khidmat Home Care`,
  description: privacy.description,
  bilingual: false,
});

export default function Page() {
  return <LegalPage doc={privacy} />;
}
