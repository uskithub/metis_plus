import { defineConfig } from "vite"
export default defineConfig({
  build: {
    cssCodeSplit: false, // content.css にまとめる
    rollupOptions: {
      input: {
        background: "src/background.ts"
      },
      output: {
        entryFileNames: "[name].js",
        globals: {
          "./libmain.js": "Module"
        },
        inlineDynamicImports: true
      },
      external: ["./libmain.js"] // libmain.js を外部ファイルとして扱う
    },
    outDir: "dist",
    sourcemap: true,
    minify: false,
    emptyOutDir: true
  }
})
