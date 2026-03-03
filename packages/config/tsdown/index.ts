import { defineConfig, type UserConfig } from "tsdown";

export type { UserConfig };
export { defineConfig };

export interface NodeLibConfig {
  entry: string[];
  dts?: boolean;
  clean?: boolean;
  banner?: UserConfig["banner"];
}

export function nodeLib({
  entry,
  dts = true,
  clean = true,
  banner,
}: NodeLibConfig): UserConfig {
  return {
    entry,
    format: ["cjs"],
    dts,
    shims: true,
    clean,
    platform: "node",
    ...(banner ? { banner } : {}),
  };
}
