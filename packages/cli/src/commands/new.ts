import fs from "node:fs";
import path from "node:path";
import { input } from "@inquirer/prompts";
import { Args } from "@oclif/core";
import chalk from "chalk";
import logSymbols from "log-symbols";
import { BaseCommand } from "../base.js";

const NAME_PATTERN = /^[a-zA-Z0-9_\- ]+$/;

export default class New extends BaseCommand<typeof New> {
  static description = "Create a new migration file";

  static args = {
    name: Args.string({
      description: "Migration name",
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(New);
    const cwd = process.cwd();
    const migrationsDir = path.resolve(cwd, this.cfg.root, ".migrations");

    fs.mkdirSync(migrationsDir, { recursive: true });

    const name =
      args.name ??
      (await input({
        message: "Migration name:",
        validate: (value) => {
          if (!value.trim()) return "Migration name cannot be empty";
          if (!NAME_PATTERN.test(value))
            return "Migration name can only contain letters, numbers, underscores, hyphens and spaces";
          return true;
        },
      }));

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join("");

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    const filename = `${timestamp}_${slug}.sql`;
    const filepath = path.join(migrationsDir, filename);

    fs.writeFileSync(filepath, `-- migrate:up\n\n\n-- migrate:down\n`, "utf8");

    this.log(
      `${logSymbols.success} Created ${chalk.cyan(path.relative(cwd, filepath))}`,
    );
  }
}
