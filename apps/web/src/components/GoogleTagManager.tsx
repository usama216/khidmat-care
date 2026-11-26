import Script from "next/script";
import { site } from "@/config/site";

/**
 * Google's standard Tag Manager snippet. Loads only when NEXT_PUBLIC_GTM_ID is set.
 * Tags (GA4 and others) are managed in the GTM dashboard, not here.
 */
export function GoogleTagManager() {
  if (!site.gtmId) return null;
  const init = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${site.gtmId}');`;
  return (
    <Script id="google-tag-manager" strategy="afterInteractive">
      {init}
    </Script>
  );
}

/** Fallback for visitors without JavaScript. Goes right after the opening <body>. */
export function GoogleTagManagerNoScript() {
  if (!site.gtmId) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${site.gtmId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
