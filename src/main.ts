// Light bootstrap. The 3D wallpaper runtime is loaded from a separate chunk
// so this entry stays small even as the Three.js-heavy scene grows.

import "./styles.css";

// Vercel Web Analytics — production only. Script + beacon are same-origin
// (/_vercel/insights/*), so the strict CSP (script-src/connect-src 'self') is unaffected.
if (import.meta.env.PROD) {
  void import("@vercel/analytics").then(({ inject }) => inject());
}

void import("./orchestrator.js").then((m) => m.startApp());

// Register the service worker for offline shell caching (production only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
