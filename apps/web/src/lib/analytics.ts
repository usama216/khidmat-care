"use client";

type Fbq = (command: "track" | "trackCustom", event: string, params?: Record<string, string | number>) => void;

/**
 * Reports a conversion to the ads pixel, if one is loaded. Never sends personal details such as
 * names, phone numbers or health information.
 */
export function track(event: "Lead" | "CompleteRegistration" | "Contact", params?: Record<string, string>) {
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  fbq?.("track", event, params);
}
