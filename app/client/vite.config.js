import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build vai para client/dist, servido pelo Express em produção.
// Em desenvolvimento, o proxy encaminha /api para o backend local.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:80",
      "/static": "http://localhost:80",
    },
  },
  build: {
    outDir: "dist",
  },
});
