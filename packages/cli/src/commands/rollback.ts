import { execFileSync } from "node:child_process";
import path from "node:path";
import { BaseCommand } from "../base.js";
import { dbmateBin, dbmateEnv, formatDbmateLine } from "../utils/dbmate.js";

export default class Rollback extends BaseCommand<typeof Rollback> {
  static description = "Revert the last migration";

  public async run(): Promise<void> {
    const cwd = process.cwd();
    const migrationsDir = path.resolve(cwd, this.cfg.root, ".migrations");

    if (!this.cfg.url) {
      this.error(
        "No database URL configured. Set DATABASE_URL in your environment or specify url in damian.config.ts.",
      );
    }

    const out = execFileSync(dbmateBin(), ["rollback"], {
      stdio: "pipe",
      env: dbmateEnv(this.cfg, migrationsDir),
    });

    const text = out.toString().trim();
    if (text) {
      const formatted = text
        .split("\n")
        .map((l) => formatDbmateLine(l.trim()))
        .join("\n");
      process.stdout.write(`${formatted}\n`);
    } else {
      this.log("Nothing to roll back.");
    }
  }
}
