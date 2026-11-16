// Legal pages, in English only for now. Plain language on purpose: patients and physiotherapists
// should be able to read these. Have a lawyer review them before relying on them.

export type LegalSection = { heading: string; paragraphs?: string[]; list?: string[] };
export type LegalDocument = {
  path: string;
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

const EFFECTIVE = "16 November 2026";

export const terms: LegalDocument = {
  path: "/terms/",
  title: "Terms of service",
  description: "The rules for using Khidmat Care to book home physiotherapy in Lahore.",
  updated: EFFECTIVE,
  intro:
    "These terms apply when you use the Khidmat Care website or book home physiotherapy through us. By creating an account or booking a visit, you agree to them. If you don't agree, please don't use the service.",
  sections: [
    {
      heading: "1. What Khidmat Care does",
      paragraphs: [
        "Khidmat Care connects patients in Lahore with independent physiotherapists we have checked in person. The physiotherapist provides the treatment and is responsible for their clinical decisions. We find and verify physiotherapists, arrange bookings, keep records of each visit and help when something goes wrong.",
        "Khidmat Care is not an emergency service and not a hospital. In a medical emergency, call 1122 straight away.",
      ],
    },
    {
      heading: "2. Your account",
      list: [
        "Give us accurate details, and keep your phone number up to date.",
        "Keep your password private. You are responsible for what is done with your account.",
        "You can book for family members, such as a parent or child, if you have their permission or are their guardian.",
        "You must be at least 18 to create an account. A parent or guardian books for anyone younger.",
      ],
    },
    {
      heading: "3. Bookings",
      list: [
        "You choose a physiotherapist and a time from those shown as available. The physiotherapist then accepts or declines the order.",
        "If they decline, you can choose another physiotherapist, or our team will help.",
        "The physiotherapist sees the patient's area and condition before accepting, and the full address after accepting.",
        "Phone numbers are shared with both sides 2 hours before each session, so you can coordinate the visit.",
        "In a package, sessions are scheduled one at a time with your physiotherapist.",
      ],
    },
    {
      heading: "4. Prices and payment",
      list: [
        "The price is shown before you place the order. It is fixed for that order and doesn't change at the door.",
        "You pay the physiotherapist in cash at each visit, for that session.",
        "Don't pay more than the agreed price. If anyone asks for extra money, tell us straight away.",
      ],
    },
    {
      heading: "5. Cancelling",
      list: [
        "You can cancel a session or an order free of charge until 2 hours before the session starts.",
        "From 2 hours before the start, a session can't be cancelled through the website, because the physiotherapist is already on their way or has planned their day around it. If something serious happens, contact us and we'll help.",
        "If you repeatedly miss sessions without telling us, we may limit your bookings.",
      ],
    },
    {
      heading: "6. Health information and safety",
      list: [
        "Information on our website is general and is not medical advice. It doesn't replace a doctor.",
        "Tell your physiotherapist about your condition, surgery, medicines and anything that could affect treatment.",
        "Follow your doctor's or surgeon's instructions. The physiotherapist may stop or change treatment if it isn't safe.",
        "An adult must be at home when the patient is a child or cannot look after themselves.",
        "Treat physiotherapists with respect. We remove users who are abusive or unsafe.",
      ],
    },
    {
      heading: "7. Ratings and complaints",
      paragraphs: [
        "After a completed session you can rate it and report problems. Please be honest and fair. Our team reviews every complaint and may contact both sides. We may remove reviews that are abusive or unrelated to the treatment.",
      ],
    },
    {
      heading: "8. Booking through Khidmat Care",
      paragraphs: [
        "Please book every session with a physiotherapist you met through us on Khidmat Care. That is how we can check who visits you, keep a record of the treatment, and step in if something goes wrong. We can't help with sessions arranged outside the service.",
      ],
    },
    {
      heading: "9. Our responsibility",
      paragraphs: [
        "We take care in checking physiotherapists and running the service, but physiotherapists are independent professionals. To the extent the law allows, Khidmat Care is not responsible for losses caused by a physiotherapist's own acts, by information you didn't give us, or by events outside our control. Nothing in these terms limits any responsibility that Pakistani law doesn't allow us to limit.",
      ],
    },
    {
      heading: "10. Suspending accounts",
      paragraphs: [
        "We may suspend or close an account that breaks these terms, gives false information or puts others at risk. You can close your account at any time by contacting us.",
      ],
    },
    {
      heading: "11. Changes",
      paragraphs: [
        "We may update these terms as the service grows. We'll change the date at the top, and tell you in advance about important changes. Existing orders keep the price and terms they were placed with.",
      ],
    },
    {
      heading: "12. Law and contact",
      paragraphs: [
        "These terms are governed by the laws of Pakistan, and the courts of Lahore have jurisdiction. Questions? Email us at the address below or message us on WhatsApp.",
      ],
    },
  ],
};

export const privacy: LegalDocument = {
  path: "/privacy/",
  title: "Privacy policy",
  description: "What personal information Khidmat Care collects, why, who sees it and how it is protected.",
  updated: EFFECTIVE,
  intro:
    "Home physiotherapy involves personal and health information, so we collect only what we need to arrange safe treatment, show it only to the people who need it, and protect it carefully. This policy explains how.",
  sections: [
    {
      heading: "1. Who we are",
      paragraphs: [
        "Khidmat Care is a home physiotherapy service run by a remote team based in Lahore, Pakistan. We are responsible for the personal information described here. You can reach us at the email address at the end of this page.",
      ],
    },
    {
      heading: "2. What we collect",
      list: [
        "Account details: your name, phone number and password. Passwords are stored only in a form that can't be turned back into the password.",
        "People you book for: their name, gender, year of birth and how they are related to you.",
        "Booking details: the address and area of the visit, the treatment, preferred times and the condition you describe.",
        "Treatment records: session times and status, the physiotherapist's notes and pain scores, ratings and complaints.",
        "Physiotherapists: name, phone, gender, qualification, experience, photo, areas, availability, CNIC number, copies of the CNIC and degree, and balance and payment records.",
        "Messages you send through our contact form.",
        "Technical information: sign-in cookies, and your IP address, which we use to prevent abuse. For limiting repeated sign-ups and messages, we store it only in a scrambled form that can't be read back.",
      ],
      paragraphs: [
        "The booking form on our home page doesn't save anything. It only prepares a WhatsApp message on your phone.",
      ],
    },
    {
      heading: "3. Why we use it",
      list: [
        "To arrange and manage your treatment, and match you with a suitable physiotherapist.",
        "To check physiotherapists before they see patients.",
        "To keep a record of each visit, so you, your family and the physiotherapist can follow progress.",
        "To handle payments of commission, complaints and support.",
        "To keep the service safe, prevent fraud and meet legal obligations.",
      ],
    },
    {
      heading: "4. Who can see it",
      list: [
        "Your physiotherapist sees the patient's name, gender, age, condition and area before accepting, the full address after accepting, and your phone number from 2 hours before each session.",
        "You see your physiotherapist's name, photo, qualification, experience and rating, and their phone number from 2 hours before each session.",
        "Our staff see what their role needs. For example, the verification team sees physiotherapists' documents. Every view of a CNIC or document is recorded.",
        "Companies that run our systems: Vercel hosts the website, and Amazon Web Services stores our database and files. They process data only on our instructions.",
        "WhatsApp (Meta) carries the messages you send us there.",
        "Authorities, only when the law requires it.",
      ],
      paragraphs: ["We never sell personal information."],
    },
    {
      heading: "5. Where it is stored",
      paragraphs: [
        "Our database and uploaded files are stored with Amazon Web Services in Australia (Sydney), and the website is served through Vercel's global network. That means your information is kept on servers outside Pakistan, protected as described below.",
      ],
    },
    {
      heading: "6. How we protect it",
      list: [
        "All connections to our website and servers are encrypted.",
        "CNIC numbers are stored encrypted, so they can't be read even from a copy of the database.",
        "Documents and photos are private. They open only through links that expire after a few minutes.",
        "Staff access depends on their role, and important actions are recorded in an audit log.",
      ],
    },
    {
      heading: "7. Advertising measurement",
      paragraphs: [
        "When we run ads, we may use the Meta Pixel to count visits and sign-ups that come from them. It records page visits and whether someone signed up as a patient or a physiotherapist. We never send names, phone numbers or health information to it. You can limit ad tracking in your browser and Facebook settings.",
      ],
    },
    {
      heading: "8. How long we keep it",
      paragraphs: [
        "We keep your information while your account is open and for as long as needed afterwards to settle disputes, keep treatment and payment records, and meet legal obligations. Messages sent through the contact form are kept only as long as needed to deal with them.",
      ],
    },
    {
      heading: "9. Your choices",
      list: [
        "Ask for a copy of the information we hold about you.",
        "Ask us to correct anything that is wrong.",
        "Ask us to close your account and delete your information, except records we must keep.",
      ],
      paragraphs: ["Email us to make a request. We'll reply within 30 days."],
    },
    {
      heading: "10. Changes",
      paragraphs: [
        "We'll update this policy when we change how we use information, change the date at the top, and tell you about important changes.",
      ],
    },
  ],
};

export const physioAgreement: LegalDocument = {
  path: "/physio-agreement/",
  title: "Physiotherapist agreement",
  description: "How physiotherapists work with Khidmat Care: verification, fees, commission, sessions and conduct.",
  updated: EFFECTIVE,
  intro:
    "This agreement applies to every physiotherapist who joins Khidmat Care. You accept it when you submit your application. Please read it carefully, and ask us if anything is unclear.",
  sections: [
    {
      heading: "1. Our relationship",
      paragraphs: [
        "You work as an independent professional, not as an employee of Khidmat Care. You decide your areas and hours, and you are responsible for your clinical decisions. Khidmat Care finds patients, verifies physiotherapists, arranges bookings and provides support.",
      ],
    },
    {
      heading: "2. Verification",
      list: [
        "You must hold a physiotherapy degree (DPT or BS) and a valid CNIC.",
        "We check your documents and meet you in person before you receive patients.",
        "Your profile must be accurate and kept up to date. We may check your documents again at any time.",
      ],
    },
    {
      heading: "3. Orders",
      list: [
        "You receive orders only within the areas and hours you set.",
        "You see the patient's area and condition before accepting, and can accept or decline with a short reason.",
        "Once you accept, you are expected to attend every scheduled session.",
      ],
    },
    {
      heading: "4. Fees, commission and balance",
      list: [
        "The patient pays you in cash at each visit, at the price shown on the order. Never ask for more.",
        "Khidmat Care charges a commission on each completed session, as a percentage of the session fee. The current rate is shown on our website and in your dashboard.",
        "The commission rate is fixed when an order is placed. Changes apply only to new orders.",
        "Commission is deducted from a prepaid balance you keep with us, only after a session is completed.",
        "You need at least the minimum balance shown in your dashboard to receive new orders. Your balance can fall below zero if commission is due; please top up to continue.",
        "Top-ups are added after our team verifies the payment. Every top-up and deduction is shown in your dashboard.",
        "When you leave the platform, contact us about any remaining balance.",
      ],
    },
    {
      heading: "5. Sessions",
      list: [
        "Arrive on time, and update each session in your dashboard: on the way, arrived and completed.",
        "Record an honest pain score and short notes when you complete a session.",
        "Sessions can't be cancelled within 2 hours of the start. If an emergency stops you, contact our team immediately.",
        "Repeated late arrivals or missed sessions can lead to suspension.",
      ],
    },
    {
      heading: "6. Patients stay with Khidmat Care",
      paragraphs: [
        "Patients you meet through Khidmat Care must be served through the platform. Don't offer them sessions outside Khidmat Care, and use their phone number and address only for the sessions booked through us.",
      ],
    },
    {
      heading: "7. Conduct and safety",
      list: [
        "Be professional, respectful and honest with patients and their families.",
        "Respect patients' privacy and dignity, especially when treating women and older patients.",
        "Treat a child only when a parent or guardian is present.",
        "Work within your scope as a physiotherapist, and advise patients to see a doctor when needed.",
      ],
    },
    {
      heading: "8. Confidentiality",
      paragraphs: [
        "Patient information is confidential. Use it only to treat the patient, don't share it with anyone else, and don't keep copies after the treatment ends.",
      ],
    },
    {
      heading: "9. Ratings, complaints and suspension",
      paragraphs: [
        "Patients rate each session. Our team reviews complaints and low ratings and may contact you about them. We may suspend or remove a physiotherapist who breaks this agreement, gives false information or puts patients at risk. We'll tell you the reason.",
      ],
    },
    {
      heading: "10. Ending the agreement",
      paragraphs: [
        "You or Khidmat Care can end this agreement at any time. Sessions already accepted should be completed or handed over through our team, and the confidentiality and patient rules above continue afterwards.",
      ],
    },
    {
      heading: "11. Law",
      paragraphs: [
        "This agreement is governed by the laws of Pakistan, and the courts of Lahore have jurisdiction.",
      ],
    },
  ],
};

export const legalDocuments = [terms, privacy, physioAgreement];
