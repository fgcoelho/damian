import { createVitestConfig } from "@damiandb/config/vitest";

export default createVitestConfig({
  dirname: import.meta.dirname,
  fileParallelism: false,
});
