import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/", // Support absolute paths for BrowserRouter
  server: {
    host: "::",
    port: 3000,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
