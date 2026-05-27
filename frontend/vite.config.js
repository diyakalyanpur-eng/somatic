import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    // Prefer .jsx before .js so the renamed copies win over the old .js files
    extensions: [".jsx", ".js", ".tsx", ".ts", ".json"],
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Forward all /api/* calls from the Vite dev server to the FastAPI backend.
      // This also handles the static aisteth.html scan page, which uses relative URLs.
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
  // Expose VITE_* env vars to client (default). Also expose legacy REACT_APP_*
  // so any remaining references still work during transition.
  envPrefix: ["VITE_", "REACT_APP_"],
});
