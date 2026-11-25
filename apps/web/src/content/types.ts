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
type Qa = { q: string; a: string };
type PageMeta = { title: string; description: string };

export type PageKey = "home" | "services" | "howItWorks" | "physios" | "faq" | "contact" | "about";

export type ServicePage = {
  meta: PageMeta;
  headline: string;
  intro: string;
  conditions: string[];
  session: string[];
  duration: string;
  faqs: Qa[];
};

// Plain data only (no functions) so it can be passed to client components.
export type Dictionary = {
  locale: Locale;
  dir: "ltr" | "rtl";
  meta: PageMeta;
  pages: Record<PageKey, PageMeta>;
  nav: {
    // Paths without the language prefix, e.g. "/services/".
    links: { href: string; label: string }[];
    physios: string;
    cta: string;
    openMenu: string;
    closeMenu: string;
    switchLabel: string;
    switchLang: Locale;
    skip: string;
    home: string;
    find: string;
  };
  hero: {
    titleStart: string;
    titleHighlight: string;
    subtitle: string;
    primary: string;
    secondary: string;
    findPhysio: string;
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
    learnMore: string;
    allServices: string;
    items: Record<ServiceId, Item>;
  };
  servicePage: {
    conditionsTitle: string;
    sessionTitle: string;
    durationTitle: string;
    faqTitle: string;
    bookTreatment: string;
    otherServices: string;
    whatsappMessage: string;
    pages: Record<ServiceId, ServicePage>;
  };
  how: { eyebrow: string; title: string; steps: Item[]; cta: string; more: string };
  why: {
    eyebrow: string;
    title: string;
    subtitle: string;
    featured: Item & { checklist: string[] };
    items: Item[];
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
    ctaWhatsapp: string;
    learnMore: string;
    message: string;
  };
  physioPage: {
    eyebrow: string;
    title: string;
    subtitle: string;
    earnEyebrow: string;
    earnTitle: string;
    earnDesc: string;
    // "{keep}" is replaced with the share a physiotherapist keeps, e.g. 80.
    keepTemplate: string;
    keepFallback: string;
    commissionNote: string;
    // "{amount}" is replaced with the minimum balance, e.g. Rs 700.
    minimumTemplate: string;
    earnPoints: string[];
    stepsEyebrow: string;
    stepsTitle: string;
    steps: Item[];
    rulesTitle: string;
    rules: string[];
    agreementLink: string;
    faqTitle: string;
    faqs: Qa[];
    finalTitle: string;
    finalDesc: string;
  };
  about: {
    eyebrow: string;
    title: string;
    intro: string;
    values: Item[];
    teamTitle: string;
    teamDesc: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    moreTitle: string;
    moreCta: string;
    seeAll: string;
    items: Qa[];
  };
  contact: {
    eyebrow: string;
    title: string;
    subtitle: string;
    form: {
      name: string;
      phone: string;
      phonePlaceholder: string;
      message: string;
      messagePlaceholder: string;
      submit: string;
      submitting: string;
      privacy: string;
      invalidName: string;
      invalidPhone: string;
      invalidMessage: string;
      rateLimited: string;
      failed: string;
      successTitle: string;
      successDesc: string;
      sendAnother: string;
    };
  };
  emergency: { title: string; text: string; call: string };
  footer: {
    tagline: string;
    explore: string;
    contact: string;
    legal: string;
    terms: string;
    privacy: string;
    physioAgreement: string;
    englishOnly: string;
    location: string;
    rights: string;
    disclaimer: string;
  };
  mobileBar: { whatsapp: string; call: string };
};
