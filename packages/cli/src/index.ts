import "dotenv/config";
import { run } from "@oclif/core";
import Generate from "./commands/generate.js";
import Migrate from "./commands/migrate.js";
import New from "./commands/new.js";
import Populate from "./commands/populate.js";
import Reset from "./commands/reset.js";
import Rollback from "./commands/rollback.js";
import Sandbox from "./commands/sandbox.js";

export { config } from "./core/config.js";
export type { PopulatorDefinition } from "./populator.js";
export { populator } from "./populator.js";

export const COMMANDS = {
  new: New,
  migrate: Migrate,
  rollback: Rollback,
  reset: Reset,
  generate: Generate,
  populate: Populate,
  sandbox: Sandbox,
};

run(process.argv.slice(2), import.meta.url).catch((err) => {
  if (err?.code === "ERR_USE_AFTER_CLOSE" || err?.name === "ExitPromptError") {
    process.exit(0);
  }
  process.exitCode = 1;
  process.stderr.write(`${err?.message ?? err}\n`);
});
