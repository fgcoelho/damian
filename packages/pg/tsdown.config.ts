import { defineConfig, nodeLib } from "@damiandb/config/tsdown";

export default defineConfig(nodeLib({ entry: ["src/index.ts"] }));
