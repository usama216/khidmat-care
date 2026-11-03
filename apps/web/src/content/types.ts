export type Locale = "en" | "ur";

export const serviceIds = [
  "post-surgery",
  "stroke",
  "back-neck",
  "knee-joint",
  "elderly",
  "sports",
] as const;
export type ServiceId = (typeof serviceIds)[number];

export type GenderPreference = "any" | "female" | "male";
export type TimePreference = "morning" | "afternoon" | "evening";

type Item = { title: string; desc: string };

// Plain data only (no functions) so it can be passed to client components.
export type Dictionary = {
  locale: Locale;
  dir: "ltr" | "rtl";
  meta: { title: string; description: string };
  nav: {
    links: { href: string; label: string }[];
    physios: string;
    cta: string;
    openMenu: string;
    closeMenu: string;
    switchLabel: string;
    switchHref: string;
    switchLang: Locale;
    skip: string;
  };
  hero: {
    eyebrow: string;
    titleStart: string;
    titleHighlight: string;
    subtitle: string;
    primary: string;
    secondary: string;
    note: string;
    chips: string[];
    whatsappMessage: string;
    mock: {
      onTheWay: string;
      eta: string;
      yourPhysio: string;
      role: string;
      verified: string;
      session: string;
      painLabel: string;
      price: string;
      priceNote: string;
    };
  };
  services: {
    eyebrow: string;
    title: string;
    subtitle: string;
    book: string;
    items: Record<ServiceId, Item>;
  };
  how: { eyebrow: string; title: string; steps: Item[]; cta: string };
  why: {
    eyebrow: string;
    title: string;
    subtitle: string;
    featured: Item & { checklist: string[] };
    items: Item[];
  };
  packages: {
    eyebrow: string;
    title: string;
    subtitle: string;
    session: string;
    sessions: string;
    perSession: string;
    priceOnRequest: string;
    priceNote: string;
    cta: string;
    badge: string;
    askMessage: string;
    payment: string;
    items: (Item & { count: 1 | 5 | 10 | 15; featured?: boolean })[];
  };
  families: {
    eyebrow: string;
    title: string;
    desc: string;
    points: string[];
    cta: string;
    chat: { name: string; status: string; messages: { from: "family" | "us"; text: string; time: string }[] };
  };
  book: {
    eyebrow: string;
    title: string;
    subtitle: string;
    talkTitle: string;
    talkDesc: string;
    call: string;
    whatsapp: string;
    form: {
      service: string;
      servicePlaceholder: string;
      area: string;
      areaPlaceholder: string;
      patientName: string;
      patientAge: string;
      gender: string;
      genderOptions: Record<GenderPreference, string>;
      time: string;
      timeOptions: Record<TimePreference, string>;
      notes: string;
      notesPlaceholder: string;
      required: string;
      invalidAge: string;
      submit: string;
      privacy: string;
    };
    message: {
      greeting: string;
      service: string;
      area: string;
      patient: string;
      gender: string;
      time: string;
      notes: string;
    };
  };
  physios: {
    eyebrow: string;
    title: string;
    desc: string;
    points: string[];
    requirementsTitle: string;
    requirements: string[];
    note: string;
    cta: string;
    message: string;
  };
  faq: { eyebrow: string; title: string; moreTitle: string; moreCta: string; items: { q: string; a: string }[] };
  emergency: { title: string; text: string; call: string };
  footer: { tagline: string; explore: string; contact: string; location: string; rights: string; disclaimer: string };
  mobileBar: { whatsapp: string; call: string };
};
