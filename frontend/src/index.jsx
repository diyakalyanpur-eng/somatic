import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Expose API key to the static scan page (aisteth.html / main.js),
// which can't access Vite env vars directly.
try {
  const key = import.meta.env.VITE_API_KEY;
  if (key) localStorage.setItem("somatic.apiKey", key);
} catch {}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
