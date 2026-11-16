import { notFound } from "next/navigation";
import { ServiceDetailPage } from "@/components/pages/ServicePages";
import { en } from "@/content/en";
import { serviceIds, type ServiceId } from "@/content/types";
import { pageMetadata } from "@/lib/metadata";
import { servicePath } from "@/lib/routes";

type Props = { params: Promise<{ slug: string }> };

// Every service page is built ahead of time; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return serviceIds.map((slug) => ({ slug }));
}

function isService(slug: string): slug is ServiceId {
  return (serviceIds as readonly string[]).includes(slug);
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (!isService(slug)) return {};
  return pageMetadata({ locale: "en", path: servicePath(slug), ...en.servicePage.pages[slug].meta });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!isService(slug)) notFound();
  return <ServiceDetailPage t={en} id={slug} />;
}
