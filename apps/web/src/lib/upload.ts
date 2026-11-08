import { site } from "@/config/site";
import { ApiError, apiPost } from "@/lib/api";

export type FilePurpose = "PROVIDER_PHOTO" | "PROVIDER_DOCUMENT" | "TOPUP_PROOF";

const MAX_BYTES = 8 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const DOCUMENT_ACCEPT = `${IMAGE_ACCEPT},application/pdf`;

// Local development returns paths on the API. S3 returns full URLs.
export function storageUrl(url: string) {
  return url.startsWith("/") ? `${site.apiUrl}${url}` : url;
}

type UploadTicket = { file_id: string; upload: { url: string; fields: Record<string, string> } };

/** Upload to whichever storage the API chose, then ask the API to verify the file. */
export async function uploadFile(file: File, purpose: FilePurpose): Promise<string> {
  if (file.size === 0) throw new ApiError(400, "invalid_file", "This file is empty.");
  if (file.size > MAX_BYTES) throw new ApiError(400, "invalid_file", "This file is too large. The limit is 8 MB.");

  const ticket = await apiPost<UploadTicket>("/files/uploads", {
    purpose,
    mime_type: file.type,
    size_bytes: file.size,
  });

  const form = new FormData();
  for (const [key, value] of Object.entries(ticket.upload.fields)) form.append(key, value);
  form.append("file", file); // S3 requires the file to be the last field.

  let uploaded: Response;
  try {
    uploaded = await fetch(storageUrl(ticket.upload.url), { method: "POST", body: form });
  } catch {
    throw new ApiError(0, "network_error", "The upload failed. Check your connection and try again.");
  }
  if (!uploaded.ok) {
    // Storage explains a rejection in XML. Logged for support; it holds no secrets.
    const body = await uploaded.text().catch(() => "");
    const tag = (name: string) => body.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];
    console.error("Storage rejected the upload:", uploaded.status, tag("Code"), tag("Message"));
    throw new ApiError(uploaded.status, "upload_failed", "The upload failed. Please try again.");
  }

  await apiPost(`/files/${ticket.file_id}/confirm`);
  return ticket.file_id;
}
