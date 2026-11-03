// Business details for the landing page.
// Per-deployment values come from NEXT_PUBLIC_* env vars (see .env.example). They are built into
// the public page, so they must never contain secrets.

function env(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

const phone = env(process.env.NEXT_PUBLIC_PHONE, "+923000080216");

export const site = {
  name: "Khidmat Care",
  url: env(process.env.NEXT_PUBLIC_SITE_URL, "https://khidmat.care").replace(/\/+$/, ""),
  // Off by default so test deployments (e.g. *.vercel.app) never end up in Google.
  allowIndexing: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true",

  // Country code + number, digits only (wa.me format).
  whatsappNumber: env(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, "923000080216").replace(/\D/g, ""),
  phone,
  phoneDisplay: formatPakistaniPhone(phone),

  // Package prices in PKR (total for the package). `null` shows "Price on WhatsApp".
  // Fill these in after Phase 0 rates are agreed with the physiotherapists.
  packagePrices: {
    1: null,
    5: null,
    10: null,
    15: null,
  } as Record<PackageSize, number | null>,
} as const;

// "+923001234567" -> "+92 300 1234567"; anything else is shown as given.
function formatPakistaniPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("92") ? `+92 ${digits.slice(2, 5)} ${digits.slice(5)}` : value;
}

export const packageSizes = [1, 5, 10, 15] as const;
export type PackageSize = (typeof packageSizes)[number];

// Suggestions for the area field. Patients can still type any area.
export const lahoreAreas = [
  "Allama Iqbal Town",
  "Askari",
  "Bahria Town",
  "Cantt",
  "DHA",
  "EME Society",
  "Faisal Town",
  "Garden Town",
  "Gulberg",
  "Gulshan-e-Ravi",
  "Johar Town",
  "Lake City",
  "Model Town",
  "Samanabad",
  "Shadman",
  "Township",
  "Valencia",
  "Wapda Town",
];
