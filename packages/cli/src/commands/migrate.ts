import { BaseCommand } from "../base";
import { requireDatabaseUrl } from "../core/config";
import { formatDbmateOutput, runDbmateCommand } from "../core/dbmate";
import { logger } from "../core/logger";
import { resolveMigrationsDir } from "../core/migrations";

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
