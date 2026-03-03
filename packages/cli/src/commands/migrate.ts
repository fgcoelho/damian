import { BaseCommand } from "../base.js";
import { requireDatabaseUrl } from "../core/config.js";
import { formatDbmateOutput, runDbmateCommand } from "../core/dbmate.js";
import { logger } from "../core/logger.js";
import { resolveMigrationsDir } from "../core/migrations.js";

export default class Migrate extends BaseCommand<typeof Migrate> {
  static description = "Run all pending migrations";

  public async run(): Promise<void> {
    requireDatabaseUrl(this.cfg);
    const migrationsDir = resolveMigrationsDir(this.cfg);
    const output = runDbmateCommand("migrate", this.cfg, migrationsDir);

    if (output) {
      logger.line(formatDbmateOutput(output));
    } else {
      logger.success("No pending migrations.");
    }
  }
}
