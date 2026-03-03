import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = {
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: true,
  shims: true,
  clean: true,
  platform: "node",
};

export default defineConfig(config);
