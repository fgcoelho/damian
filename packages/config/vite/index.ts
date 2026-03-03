import path from "node:path";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export function createViteConfig(dirname: string): UserConfig {
  return defineConfig({
    plugins: [tsconfigPaths()],
    build: {
      sourcemap: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(dirname, "./src"),
      },
    },
  });
}
