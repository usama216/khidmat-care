import type { Locale } from "@/content/types";
import { apiPost } from "@/lib/api";

export type ContactMessagePayload = {
  name: string;
  phone: string;
  message: string;
  locale: Locale;
  website: string; // Honeypot: stays empty for real visitors.
};

export function sendContactMessage(payload: ContactMessagePayload) {
  return apiPost<{ status: "received" }>("/contact-messages", payload);
}
