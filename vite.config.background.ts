import { defineConfig } from "vite";
export default defineConfig({
  build: {
    cssCodeSplit: false, // content.css にまとめる
    rollupOptions: {
      input: {
        background: "src/background.ts",
      },
      output: {
        entryFileNames: "[name].js",
        inlineDynamicImports: true,
        format: "iife",
        globals: {
          "./libmain.js" : "Module",
        }
      },
      external: ["./libmain.js"], // libmain.js を外部ファイルとして扱う
    },
    outDir: "dist",
    sourcemap: true,
    minify: false,
    emptyOutDir: true,
  },
});
