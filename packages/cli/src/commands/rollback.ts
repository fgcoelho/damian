import { BaseCommand } from "../base";
import { requireDatabaseUrl } from "../core/config";
import { formatDbmateOutput, runDbmateCommand } from "../core/dbmate";
import { logger } from "../core/logger";
import { resolveMigrationsDir } from "../core/migrations";

export default class Rollback extends BaseCommand<typeof Rollback> {
  static description = "Revert the last migration";

  public async run(): Promise<void> {
    requireDatabaseUrl(this.cfg);
    const migrationsDir = resolveMigrationsDir(this.cfg);
    const output = runDbmateCommand("rollback", this.cfg, migrationsDir);

    if (output) {
      logger.line(formatDbmateOutput(output));
    } else {
      logger.info("Nothing to roll back.");
    }
  }
}
