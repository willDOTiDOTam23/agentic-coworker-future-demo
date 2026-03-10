import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000"
    }
  },
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: {
        customer: path.resolve(__dirname, "customer.html"),
        ops: path.resolve(__dirname, "ops.html")
      }
    }
  }
});
