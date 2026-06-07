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
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
  envPrefix: ["VITE_", "REACT_APP_"],
  build: {
    rollupOptions: {
      output: {
        // Split heavy libraries into separate cached chunks so the initial
        // bundle (react + router + app shell) stays small and parses fast.
        manualChunks(id) {
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
            return "vendor-charts";
          }
          if (id.includes("node_modules/framer-motion")) {
            return "vendor-motion";
          }
          if (id.includes("node_modules/three")) {
            return "vendor-three";
          }
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
