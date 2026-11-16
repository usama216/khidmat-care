import Script from "next/script";
import { site } from "@/config/site";

/** Meta's standard pixel snippet. Loads only when NEXT_PUBLIC_META_PIXEL_ID is set. */
export function MetaPixel() {
  if (!site.metaPixelId) return null;
  const init = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;
n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${site.metaPixelId}');fbq('track','PageView');`;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {init}
    </Script>
  );
}
