import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify"

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  build: {
    cssCodeSplit: false, // content.css にまとめる
    rollupOptions: {
      input: {
        content: "src/content.ts",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (chunkInfo) => {
          if (chunkInfo.name?.endsWith(".css")) {
            return "content.css";
          }
          return "[name].[ext]";
        },
        inlineDynamicImports: true,
        format: "iife",
      }
    },
    outDir: "dist",
    sourcemap: true,
    minify: true,
    emptyOutDir: true,
  },
});
