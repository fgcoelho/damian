import fs from "node:fs";
import path from "node:path";
import { input } from "@inquirer/prompts";
import { Args } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../base.js";
import { logger } from "../core/logger.js";
import { resolveMigrationsDir } from "../core/migrations.js";

const NAME_PATTERN = /^[a-zA-Z0-9_\- ]+$/;

function buildTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

async function promptMigrationName(): Promise<string> {
  return input({
    message: "Migration name:",
    validate: (value) => {
      if (!value.trim()) return "Migration name cannot be empty";
      if (!NAME_PATTERN.test(value)) {
        return "Migration name can only contain letters, numbers, underscores, hyphens and spaces";
      }
      return true;
    },
  });
}

export default class New extends BaseCommand<typeof New> {
  static description = "Create a new migration file";

  static args = {
    name: Args.string({ description: "Migration name", required: false }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(New);
    const migrationsDir = resolveMigrationsDir(this.cfg);

    fs.mkdirSync(migrationsDir, { recursive: true });

    const name = args.name ?? (await promptMigrationName());
    const filename = `${buildTimestamp()}_${slugify(name)}.sql`;
    const filepath = path.join(migrationsDir, filename);

    fs.writeFileSync(filepath, `-- migrate:up\n\n\n-- migrate:down\n`, "utf8");

    logger.success(
      `Created ${chalk.cyan(path.relative(process.cwd(), filepath))}`,
    );
  }
}
