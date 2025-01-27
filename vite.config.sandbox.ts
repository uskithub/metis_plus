import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    {
      name: "configure-response-headers",
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp")
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin")
          next()
        })
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        sandbox: "sandbox.html"
      },
      output: {
        entryFileNames: "[name].js"
      }
    },
    outDir: "dist",
    sourcemap: true,
    minify: true,
    emptyOutDir: false
  }
})
