"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Sends old links on to their new page. A static site can't answer with a real redirect. */
export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return (
    <p className="p-6 text-sm text-stone-600">
      Moving you to <a href={to} className="font-semibold underline">the physiotherapist list</a>...
    </p>
  );
}
