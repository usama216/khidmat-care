import type { Metadata } from "next";
import { Redirect } from "@/components/Redirect";

export const metadata: Metadata = { title: "Find a physiotherapist" };

// The list moved to the public site, where patients can also book without an account first.
export default function Page() {
  return <Redirect to="/physiotherapists/" />;
}
