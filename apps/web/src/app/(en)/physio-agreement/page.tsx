import { LegalPage } from "@/components/pages/LegalPage";
import { physioAgreement } from "@/content/legal";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  locale: "en",
  path: physioAgreement.path,
  title: `${physioAgreement.title} | Khidmat Care`,
  description: physioAgreement.description,
  bilingual: false,
});

export default function Page() {
  return <LegalPage doc={physioAgreement} />;
}
