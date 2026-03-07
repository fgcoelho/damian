import "dotenv/config";
import { run } from "@oclif/core";
import Generate from "./commands/generate";
import Migrate from "./commands/migrate";
import New from "./commands/new";
import Populate from "./commands/populate";
import Reset from "./commands/reset";
import Rollback from "./commands/rollback";
import Sandbox from "./commands/sandbox";

export { config } from "./core/config";
export type { PopulatorDefinition } from "./populator";
export { populator } from "./populator";

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
