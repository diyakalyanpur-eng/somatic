import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Expose API key to the static scan page (aisteth.html / main.js),
// which can't access Vite env vars directly.
// Use VITE_API_KEY (build-time) OR window.__somatic.apiKey (injected at runtime by /config.js).
try {
  const key = import.meta.env.VITE_API_KEY || window.__somatic?.apiKey || "";
  if (key) localStorage.setItem("somatic.apiKey", key);
} catch {}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
