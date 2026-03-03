import { defineConfig, type UserConfig } from "tsdown";

const cli: UserConfig = {
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  shims: true,
  clean: true,
  platform: "node",
  banner: {
    js: "#!/usr/bin/env node",
  },
};

const runtime: UserConfig = {
  entry: ["src/runtime.ts"],
  format: ["cjs"],
  dts: true,
  shims: true,
  clean: false,
  platform: "node",
};

const worker: UserConfig = {
  entry: ["src/workers/generate.ts", "src/workers/populate.ts"],
  format: ["cjs"],
  dts: false,
  shims: true,
  clean: false,
  platform: "node",
};

export default defineConfig([cli, runtime, worker]);
