import { execFileSync } from "node:child_process";
import path from "node:path";
import logSymbols from "log-symbols";
import { BaseCommand } from "../base.js";
import { dbmateBin, dbmateEnv, formatDbmateLine } from "../utils/dbmate.js";

export default class Migrate extends BaseCommand<typeof Migrate> {
  static description = "Run all pending migrations";

  public async run(): Promise<void> {
    const cwd = process.cwd();
    const migrationsDir = path.resolve(cwd, this.cfg.root, ".migrations");

    if (!this.cfg.url) {
      this.error(
        "No database URL configured. Set DATABASE_URL in your environment or specify url in damian.config.ts.",
      );
    }

    const out = execFileSync(dbmateBin(), ["migrate"], {
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
      this.log(`${logSymbols.success} No pending migrations.`);
    }
  }
}
