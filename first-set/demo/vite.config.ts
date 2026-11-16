import { defineConfig } from "vitest/config";

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/ddx-first-approach/" : "/",
  server: { fs: { allow: [".."] } },
  test: { include: ["test-logic.mjs"] },
}));
