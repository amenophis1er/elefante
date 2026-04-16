import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "src/dashboard"),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, "dist/dashboard"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3333",
    },
  },
});
