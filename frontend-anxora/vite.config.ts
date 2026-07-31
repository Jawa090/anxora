import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/", // Support absolute paths for BrowserRouter
  server: {
    host: "::",
    port: 3001,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:4002",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:4002",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
