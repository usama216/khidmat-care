"use client";

import { useState } from "react";
import { errorMessage } from "@/components/admin/ui";
import { storageUrl } from "@/lib/upload";
import { fileUrl } from "./operationsApi";

/** Opens a private document in a new tab through a short-lived link. Each view is audited. */
export function useOpenFile(fallback = "This document couldn't be opened.") {
  const [error, setError] = useState<string | null>(null);

  const open = async (fileId: string) => {
    setError(null);
    // Opened before the request finishes, so pop-up blockers allow it.
    const tab = window.open("", "_blank");
    try {
      const { url } = await fileUrl(fileId);
      if (tab) tab.location.href = storageUrl(url);
    } catch (failure) {
      tab?.close();
      setError(errorMessage(failure, fallback));
    }
  };

  return { open, error };
}
