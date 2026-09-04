// Light bootstrap. The 3D wallpaper runtime is loaded from a separate chunk
// so this entry stays small even as the Three.js-heavy scene grows.

import "./styles.css";

// Cloudflare Web Analytics — production only. The site token is a public
// identifier embedded in every page, not a secret.
if (import.meta.env.PROD) {
  const beacon = document.createElement("script");
  beacon.type = "module";
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = '{"token": "cd156fbf0fd24da0a12e58fdb4e63828"}';
  document.head.appendChild(beacon);
}

void import("./orchestrator.js").then((m) => m.startApp());

// Register the service worker for offline shell caching (production only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
