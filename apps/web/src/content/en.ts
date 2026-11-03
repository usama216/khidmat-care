import type { Dictionary } from "./types";

export const en: Dictionary = {
  locale: "en",
  dir: "ltr",
  meta: {
    title: "Khidmat Care: Home Physiotherapy in Lahore",
    description:
      "Verified physiotherapists visit you at home in Lahore, for post-surgery rehab, stroke, back pain and elderly care. Fixed prices, female physios available, and progress recorded after every session.",
  },
  nav: {
    links: [
      { href: "#services", label: "Services" },
      { href: "#how", label: "How it works" },
      { href: "#packages", label: "Packages" },
      { href: "#faq", label: "FAQ" },
    ],
    physios: "For physiotherapists",
    cta: "Book on WhatsApp",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    switchLabel: "اردو",
    switchHref: "/ur/",
    switchLang: "ur",
    skip: "Skip to content",
  },
  hero: {
    eyebrow: "Home physiotherapy in Lahore",
    titleStart: "Expert physiotherapy,",
    titleHighlight: "at home.",
    subtitle:
      "A verified physiotherapist comes to your home after surgery, a stroke or an injury, and for elderly care. You get a fixed price, the option of a female physio, and progress your family can follow.",
    primary: "Book on WhatsApp",
    secondary: "See how it works",
    note: "No app needed. Just send us a message.",
    chips: [
      "Physios verified in person",
      "Female physio option",
      "Fixed price, told upfront",
      "Pay in cash at the visit",
    ],
    whatsappMessage: "Assalam o Alaikum Khidmat Care, I'd like to book home physiotherapy.",
    mock: {
      onTheWay: "On the way",
      eta: "15 min away",
      yourPhysio: "Your physiotherapist",
      role: "Female physiotherapist · DPT",
      verified: "Verified",
      session: "Session 4 of 10",
      painLabel: "Pain score",
      price: "Fixed price",
      priceNote: "Cash at the visit",
    },
  },
  services: {
    eyebrow: "What we treat",
    title: "Physiotherapy for the problems that keep people at home",
    subtitle: "Tell us what you need help with, and we'll send a physiotherapist who treats that problem.",
    book: "Book this",
    items: {
      "post-surgery": {
        title: "Post-surgery rehab",
        desc: "Get strength and movement back after knee or hip replacement, a fracture or spine surgery.",
      },
      stroke: {
        title: "Stroke rehab",
        desc: "Work on movement, balance and independence after a stroke or paralysis.",
      },
      "back-neck": {
        title: "Back & neck pain",
        desc: "Relief from a slipped disc, sciatica, stiffness and pain from bad posture.",
      },
      "knee-joint": {
        title: "Knee & joint pain",
        desc: "Treatment for arthritis, frozen shoulder and stiff joints.",
      },
      elderly: {
        title: "Elderly mobility",
        desc: "Safer walking, better balance and fewer falls for older family members.",
      },
      sports: {
        title: "Sports injuries",
        desc: "Get back to your sport after sprains, ligament tears and muscle injuries.",
      },
    },
  },
  how: {
    eyebrow: "How it works",
    title: "Physiotherapy at home in three steps",
    steps: [
      {
        title: "Tell us the problem",
        desc: "Message us on WhatsApp or fill in the short form below. It takes about a minute.",
      },
      {
        title: "We find a verified physio",
        desc: "We match your area, the problem and whether you want a male or female physio. You see their profile and the fixed price before you confirm.",
      },
      {
        title: "Treatment at your home",
        desc: "Your physio comes at the agreed time. After each session we write down notes and a pain score, so you can see the progress.",
      },
    ],
    cta: "Start on WhatsApp",
  },
  why: {
    eyebrow: "Why Khidmat Care",
    title: "Safe, simple home care you can trust",
    subtitle: "Finding home care through phone calls is guesswork. We check the physio, fix the price and keep a record of every visit.",
    featured: {
      title: "Every physio is checked in person",
      desc: "Before a physiotherapist sees any patient, we meet them ourselves and check their documents. Being in a WhatsApp group is not enough.",
      checklist: [
        "Physiotherapy degree checked",
        "CNIC verified",
        "Met in person",
        "Patient feedback after every visit",
      ],
    },
    items: [
      {
        title: "Female physios available",
        desc: "If you'd prefer a woman physiotherapist, just choose that when you book.",
      },
      {
        title: "Fixed price, told upfront",
        desc: "You know the price before the first visit. No bargaining and no surprises.",
      },
      {
        title: "Progress you can see",
        desc: "Notes and a pain score after every session, shared with you and your family.",
      },
      {
        title: "A replacement if needed",
        desc: "If your physio can't come, we send another one so the treatment doesn't stop.",
      },
    ],
  },
  packages: {
    eyebrow: "Session packages",
    title: "Most recovery takes more than one visit",
    subtitle:
      "Packages cost less per session, and where possible the same physio treats you from start to finish.",
    session: "session",
    sessions: "sessions",
    perSession: "per session",
    priceOnRequest: "Price on WhatsApp",
    priceNote: "The exact price depends on the treatment. We confirm it before your first visit.",
    cta: "Ask for the price",
    badge: "Best for recovery",
    askMessage: "Assalam o Alaikum Khidmat Care, what is the price of the {count}-session physiotherapy package?",
    payment: "Pay in cash at the visit. Online payment is coming later.",
    items: [
      { count: 1, title: "Single visit", desc: "A check-up or a one-off session." },
      { count: 5, title: "Short course", desc: "For recent pain or a small injury." },
      { count: 10, title: "Recovery plan", desc: "For most rehab, including after surgery.", featured: true },
      { count: 15, title: "Long-term care", desc: "For stroke rehab and elderly mobility." },
    ],
  },
  families: {
    eyebrow: "For families abroad",
    title: "Look after your parents in Lahore, wherever you live",
    desc: "Book on WhatsApp from any country. After each session you get an update: what was done, the pain score and the date of the next visit.",
    points: [
      "A verified physio comes to your parents' home",
      "An update after every session",
      "One number to contact if anything changes",
    ],
    cta: "Book for your parents",
    chat: {
      name: "Khidmat Care",
      status: "WhatsApp Business",
      messages: [
        {
          from: "family",
          text: "Assalam o Alaikum, my father had knee surgery. We need a physio at home in Johar Town.",
          time: "9:41",
        },
        {
          from: "us",
          text: "Walaikum Assalam! We have a verified physiotherapist for Johar Town. Sending you the profile and the price now.",
          time: "9:43",
        },
        {
          from: "us",
          text: "Session 3 done ✓ Pain score went from 6 to 4. Next visit: Thursday, 10 am.",
          time: "18:05",
        },
      ],
    },
  },
  book: {
    eyebrow: "Book a visit",
    title: "Book a home physiotherapy visit",
    subtitle: "Fill in a few details and we'll open WhatsApp with your message ready to send.",
    talkTitle: "Would you rather talk?",
    talkDesc: "Call us or send a WhatsApp message, and we'll help you choose the right treatment.",
    call: "Call us",
    whatsapp: "Message on WhatsApp",
    form: {
      service: "What do you need help with?",
      servicePlaceholder: "Choose a treatment",
      area: "Area in Lahore",
      areaPlaceholder: "e.g. Johar Town",
      patientName: "Patient's name",
      patientAge: "Patient's age",
      gender: "Physiotherapist",
      genderOptions: { any: "No preference", female: "Female", male: "Male" },
      time: "Best time",
      timeOptions: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" },
      notes: "Anything else we should know? (optional)",
      notesPlaceholder: "e.g. Knee replacement 3 weeks ago, can walk with support",
      required: "Please fill this in.",
      invalidAge: "Please enter a valid age.",
      submit: "Continue on WhatsApp",
      privacy: "This website doesn't save your details. They only go into your WhatsApp message.",
    },
    message: {
      greeting: "Assalam o Alaikum Khidmat Care, I'd like to book home physiotherapy.",
      service: "Treatment",
      area: "Area",
      patient: "Patient",
      gender: "Physiotherapist",
      time: "Best time",
      notes: "Notes",
    },
  },
  physios: {
    eyebrow: "For physiotherapists",
    title: "Are you a physiotherapist in Lahore?",
    desc: "Join Khidmat Care and get home-visit patients in the areas and at the times that suit you.",
    points: [
      "Patients near you who need your specialty",
      "Fixed rates, so no bargaining with patients",
      "You choose your areas and hours",
      "A verified profile that patients can trust",
    ],
    requirementsTitle: "What you need",
    requirements: [
      "A degree in physiotherapy (DPT or BS)",
      "A valid CNIC",
      "Home-visit experience is a plus",
    ],
    note: "We check every document in person before you get your first patient.",
    cta: "Apply on WhatsApp",
    message:
      "Assalam o Alaikum, I'm a physiotherapist in Lahore and I'd like to join Khidmat Care.\n\nName:\nQualification:\nYears of experience:\nAreas I can cover:\nGender:",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Common questions",
    moreTitle: "Have another question?",
    moreCta: "Ask us on WhatsApp",
    items: [
      {
        q: "Which areas of Lahore do you cover?",
        a: "We work across Lahore. Tell us your area when you book, and we'll confirm if a verified physio is available near you.",
      },
      {
        q: "How much does a session cost?",
        a: "Each treatment has a fixed price, and packages cost less per session. We tell you the exact price on WhatsApp before you confirm, so there's no bargaining at the door.",
      },
      {
        q: "How do you check the physiotherapists?",
        a: "We meet every physiotherapist in person and check their degree and CNIC. Being in a group or having an online profile is not enough to join.",
      },
      {
        q: "Can I ask for a female physiotherapist?",
        a: "Yes. Choose “Female” when you book, and we'll send a female physiotherapist.",
      },
      {
        q: "How do I pay?",
        a: "For now, you pay in cash at the visit. Online payment is coming later.",
      },
      {
        q: "Can I book for my parents from abroad?",
        a: "Yes. Book on WhatsApp from any country, and we'll send you an update after every session.",
      },
      {
        q: "What if my physiotherapist can't come?",
        a: "We'll tell you in advance and send another physiotherapist, so the treatment continues.",
      },
      {
        q: "Do I need a doctor's referral?",
        a: "You don't need one to book. If you have a doctor's note, X-ray or reports, send them on WhatsApp so the physio can plan the treatment.",
      },
      {
        q: "Is Khidmat Care for emergencies?",
        a: "No. In a medical emergency, call 1122 straight away. Khidmat Care is for planned treatment at home.",
      },
    ],
  },
  emergency: {
    title: "Medical emergency?",
    text: "Call 1122 straight away. Khidmat Care is for planned treatment at home, not for emergencies.",
    call: "Call 1122",
  },
  footer: {
    tagline: "Home physiotherapy in Lahore by verified physiotherapists.",
    explore: "Explore",
    contact: "Contact",
    location: "Lahore, Pakistan",
    rights: "Khidmat Care. All rights reserved.",
    disclaimer: "Khidmat Care connects patients with independent, verified physiotherapists.",
  },
  mobileBar: { whatsapp: "WhatsApp", call: "Call" },
};
