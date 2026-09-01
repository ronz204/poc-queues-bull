import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@assets": `${import.meta.dirname}/source/assets`,
      "@styles": `${import.meta.dirname}/source/styles`,
    },
  },
});
