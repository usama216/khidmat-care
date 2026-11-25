"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, LoaderCircle, UserRound } from "lucide-react";
import { adminButton, errorMessage } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { IMAGE_ACCEPT, storageUrl, uploadFile } from "@/lib/upload";

/**
 * The profile photo. The chosen picture shows at once, while it uploads and saves behind it; if
 * that fails, the previous photo comes back with the reason.
 */
export function PhotoPicker({
  currentUrl,
  savedNote,
  onUploaded,
  onBusyChange,
}: {
  currentUrl: string | null;
  savedNote: string;
  onUploaded: (fileId: string) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = state === "busy";

  // Frees the picture from memory once it's replaced or the page closes.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const onChange = async (file: File | undefined) => {
    if (!file) return;
    // A second try keeps the last photo that did save as the one to fall back to.
    const previous = state === "done" ? preview : null;
    const previousFile = previous ? await fetch(previous).then((r) => r.blob()).catch(() => null) : null;
    setError(null);
    setState("busy");
    onBusyChange(true);
    setPreview(URL.createObjectURL(file));
    try {
      await onUploaded(await uploadFile(file, "PROVIDER_PHOTO"));
      setState("done");
    } catch (failure) {
      setPreview(previousFile ? URL.createObjectURL(previousFile) : null);
      setState(previousFile ? "done" : "idle");
      setError(errorMessage(failure, "The photo couldn't be saved. Please try again."));
    } finally {
      onBusyChange(false);
      if (input.current) input.current.value = "";
    }
  };

  const shown = preview ?? (currentUrl ? storageUrl(currentUrl) : null);

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Your photo" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-stone-400">
            <UserRound className="size-9" aria-hidden="true" />
          </span>
        )}
        {busy ? (
          <span className="absolute inset-0 grid place-items-center bg-stone-900/45 text-white">
            <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900">Your photo</p>
        <p className="mt-0.5 text-xs text-stone-500">A clear photo of your face. JPG, PNG or WebP, up to 8 MB.</p>
        <label className={cn(adminButton("secondary", "mt-2 focus-within:ring-2 focus-within:ring-brand-600"), busy ? "opacity-50" : "cursor-pointer")}>
          <Camera className="size-4" aria-hidden="true" />
          {shown ? "Change photo" : "Add photo"}
          <input
            ref={input}
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={busy}
            className="sr-only"
            aria-label="Your photo"
            onChange={(event) => void onChange(event.target.files?.[0])}
          />
        </label>
        <div aria-live="polite" className="mt-1.5 text-xs font-medium empty:hidden">
          {busy ? <p className="text-stone-600">Uploading and saving...</p> : null}
          {state === "done" && !error ? (
            <p className="flex items-center gap-1 text-brand-800">
              <Check className="size-3.5" aria-hidden="true" />
              {savedNote}
            </p>
          ) : null}
          {error ? <p className="text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
