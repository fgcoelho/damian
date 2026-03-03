import ora from "ora";
import { BaseCommand } from "../base.js";
import { resetDatabase } from "../utils/reset.js";

export default class Reset extends BaseCommand<typeof Reset> {
  static description = "Drop all schemas and recreate public";

  public async run(): Promise<void> {
    if (!this.cfg.url) {
      this.error(
        "No database URL configured. Set DATABASE_URL in your environment or specify url in damian.config.ts.",
      );
    }

    const spin = ora({
      text: "Resetting database...",
      spinner: "dots",
    }).start();
    await resetDatabase(this.cfg.url);
    spin.succeed("Database reset.");
  }
}
