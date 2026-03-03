import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const jsToTs = {
  name: "js-to-ts",
  resolveId(id: string, importer?: string) {
    if (importer && id.startsWith(".") && id.endsWith(".js")) {
      const tsPath = `${id.slice(0, -3)}.ts`;
      const resolved = path.resolve(path.dirname(importer), tsPath);
      return resolved;
    }
  },
};

export default defineConfig({
  plugins: [tsconfigPaths(), jsToTs],
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./test/setup.ts",
    printConsoleTrace: true,
    exclude: [
      "node_modules",
      "dist",
      "assets",
      "fonts",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{vitest,build,eslint,prettier}.config.*",
    ],
  },
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
