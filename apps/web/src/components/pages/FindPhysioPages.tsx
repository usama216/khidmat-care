import { en } from "@/content/en";
import { PageHero } from "@/components/site/blocks";
import { SiteShell } from "@/components/site/SiteShell";
import { PhysioDirectory } from "@/features/public/PhysioDirectory";
import { PhysioProfileView } from "@/features/public/PhysioProfileView";
import { findPhysioPath } from "@/lib/routes";

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
        lead="Compare experience, fees and ratings, then pick a free slot from their calendar. Prefer to let us choose? Tell us what you need and we'll show who's free."
      />
      <PhysioDirectory />
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
