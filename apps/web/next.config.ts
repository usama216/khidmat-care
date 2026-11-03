import type { NextConfig } from "next";

// Phase 0 is a fully static site (no server), so it can be hosted for free on Cloudflare Pages.
// When v1 needs server features, remove `output: "export"`.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
