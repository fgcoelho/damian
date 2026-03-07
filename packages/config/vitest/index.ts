import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export interface VitestConfigOptions {
  dirname: string;
  fileParallelism?: boolean;
}

export function createVitestConfig({
  dirname,
  fileParallelism,
}: VitestConfigOptions) {
  return defineConfig({
    plugins: [tsconfigPaths()],
    test: {
      globals: true,
      environment: "node",
      ...(fileParallelism !== undefined ? { fileParallelism } : {}),
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
        "@": path.resolve(dirname, "./src"),
      },
    },
  });
}
