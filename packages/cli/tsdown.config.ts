import { defineConfig, nodeLib } from "@damiandb/config/tsdown";

const cli = nodeLib({
  entry: ["src/index.ts"],
  dts: false,
  banner: { js: "#!/usr/bin/env node" },
});

const runtime = nodeLib({
  entry: ["src/runtime.ts"],
  clean: false,
});

const worker = nodeLib({
  entry: ["src/workers/generate.ts", "src/workers/populate.ts"],
  dts: false,
  clean: false,
});

export default defineConfig([cli, runtime, worker]);
