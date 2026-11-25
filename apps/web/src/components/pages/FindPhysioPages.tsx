import { en } from "@/content/en";
import { PageHero } from "@/components/site/blocks";
import { SiteShell } from "@/components/site/SiteShell";
import { PhysioDirectory } from "@/features/public/PhysioDirectory";
import { PhysioProfileView } from "@/features/public/PhysioProfileView";
import { lahoreAreas } from "@/config/site";
import { serviceIds } from "@/content/types";
import { findPhysioPath, servicePath } from "@/lib/routes";

// Booking happens in English for now, like the patient and physio portals.
const t = en;

export function FindPhysioPage() {
  return (
    <SiteShell t={t} path={findPhysioPath} translated={false}>
      <PageHero
        t={t}
        crumbs={[{ label: t.nav.find, path: findPhysioPath }]}
        eyebrow="Verified physiotherapists in Lahore"
        title="Find a physiotherapist and book a time"
        lead="Compare experience, fees and ratings, then pick a free slot from their calendar. Not sure who to choose? Send a request and physiotherapists near you will respond."
      />
      <PhysioDirectory />
      <section className="shell py-14 sm:py-20" aria-labelledby="areas-title">
        <h2 id="areas-title" className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Home physiotherapy across Lahore
        </h2>
        <p className="mt-2 max-w-2xl text-stone-600">
          Patients can ask for a home visit in these areas. Who is free depends on the day, so choose your area above or
          send a request. Not listed? Message us and we&apos;ll check.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {lahoreAreas.map((area) => (
            <li key={area} className="rounded-full bg-white px-4 py-2 text-sm text-stone-700 ring-1 ring-stone-200">
              {area}
            </li>
          ))}
        </ul>
        <h3 className="mt-10 text-lg font-semibold text-stone-900">What our physiotherapists treat</h3>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {serviceIds.map((id) => (
            <li key={id}>
              <a href={servicePath(id)} className="font-medium text-brand-700 hover:underline">
                {t.services.items[id].title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </SiteShell>
  );
}

export function PhysioProfilePage() {
  return (
    <SiteShell t={t} path={findPhysioPath} translated={false}>
      <PhysioProfileView />
    </SiteShell>
  );
}
