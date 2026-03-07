import ora from "ora";
import { BaseCommand } from "../base";
import { requireDatabaseUrl } from "../core/config";
import { resetDatabase } from "../utils/reset";

export default class Reset extends BaseCommand<typeof Reset> {
  static description = "Drop all schemas and recreate public";

  public async run(): Promise<void> {
    const url = requireDatabaseUrl(this.cfg);
    const spin = ora({
      text: "Resetting database...",
      spinner: "dots",
    }).start();
    await resetDatabase(url);
    spin.succeed("Database reset.");
  }
}
