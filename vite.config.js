import { resolve } from "node:path";
import { sites } from "@openai/sites-vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sites()],
  build: {
    rollupOptions: {
      input: {
        robotDemos: resolve(import.meta.dirname, "robot-demos.html"),
      },
    },
  },
});
