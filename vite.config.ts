import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    proxy: {
      "/proxy-dadmehrg": {
        target: "https://dadmehrg.ir",
        changeOrigin: true,
        secure: false,
        headers: {
          Origin: "https://admin.dadmehrg.ir",
          Referer: "https://admin.dadmehrg.ir/",
          "X-Client-Name": "site",
        },
        rewrite: (p) => p.replace(/^\/proxy-dadmehrg/, ""),
      },
      "/proxy-gozareshgir": {
        target: "https://gozareshgir.ir",
        changeOrigin: true,
        secure: false,
        headers: {
          Origin: "https://admin.gozareshgir.ir",
          Referer: "https://admin.gozareshgir.ir/",
          "X-Client-Name": "site",
        },
        rewrite: (p) => p.replace(/^\/proxy-gozareshgir/, ""),
      },
    },
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
