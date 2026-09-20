import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    target: "es2018",
    outDir: path.join(repositoryRoot, "dist", "viewer"),
    emptyOutDir: true,
    manifest: "manifest.json",
    lib: {
      entry: path.join(repositoryRoot, "src", "viewer", "entry.ts"),
      name: "YarReaderViewer",
      formats: ["iife"],
    },
    rolldownOptions: {
      output: {
        entryFileNames: "assets/viewer-[hash].js",
        chunkFileNames: "assets/viewer-[hash].js",
        assetFileNames: "assets/viewer-[hash][extname]",
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    open: "/dev/viewer/index.html",
  },
});
