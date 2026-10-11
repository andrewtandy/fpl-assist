import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5001/fpl-assist-ea982/us-central1/fplProxy",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, "")
      }
    }
  }
});