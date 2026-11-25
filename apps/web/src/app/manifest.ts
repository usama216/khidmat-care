import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "Khidmat",
    description: "Verified physiotherapists at home in Lahore.",
    start_url: "/",
    display: "browser",
    background_color: "#f8fcfb",
    theme_color: "#0b7d72",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
