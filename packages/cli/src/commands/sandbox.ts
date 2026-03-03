import { execFileSync } from "node:child_process";
import path from "node:path";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import logSymbols from "log-symbols";
import ora from "ora";
import { BaseCommand } from "../base.js";
import { dbmateBin, dbmateEnv } from "../utils/dbmate.js";
import { resetDatabase } from "../utils/reset.js";
import Generate from "./generate.js";
import {
  discoverPopulators,
  type Populator,
  runPopulators,
} from "./populate.js";

export default class Sandbox extends BaseCommand<typeof Sandbox> {
  static description =
    "Reset DB, run all migrations, generate types, and run populators";

  public async run(): Promise<void> {
    const cwd = process.cwd();

    if (!this.cfg.url) {
      this.error(
        "No database URL configured. Set DATABASE_URL in your environment or specify url in damian.config.ts.",
      );
    }

    let spin = ora({ text: "Resetting database...", spinner: "dots" }).start();
    await resetDatabase(this.cfg.url);
    spin.succeed("Database reset.");

    const migrationsDir = path.resolve(cwd, this.cfg.root, ".migrations");

    spin = ora({ text: "Running migrations...", spinner: "dots" }).start();
    execFileSync(dbmateBin(), ["migrate"], {
      stdio: "pipe",
      env: dbmateEnv(this.cfg, migrationsDir),
    });
    spin.succeed("Migrations applied.");

    await Generate.run(this.argv, this.config);

    const allPopulators = await discoverPopulators(this.cfg);
    const corePopulators = allPopulators.filter((p) => p.group === "core");
    const sandboxPopulators = allPopulators.filter(
      (p) => p.group === "sandbox",
    );

    if (corePopulators.length > 0) {
      this.log("");
      const coreSpinners = new Map<string, ReturnType<typeof ora>>();

      const coreResult = await runPopulators(corePopulators, {
        onStart: (name) => {
          coreSpinners.set(
            name,
            ora({
              text: `${chalk.dim("[core]")} ${name}`,
              spinner: "dots",
            }).start(),
          );
        },
        onDone: (name) => {
          coreSpinners.get(name)?.succeed(`${chalk.dim("[core]")} ${name}`);
        },
      });

      if (!coreResult.ok) {
        const active =
          (coreResult.name ? coreSpinners.get(coreResult.name) : undefined) ??
          [...coreSpinners.values()].find((s) => s.isSpinning);

        if (active) {
          active.fail(`${active.text} failed`);
          process.stderr.write(`${chalk.red(coreResult.message)}\n`);
        } else {
          process.stderr.write(`${logSymbols.error} ${coreResult.message}\n`);
        }
        process.exit(1);
      }
    }

    if (sandboxPopulators.length === 0) {
      this.log(
        `\n${logSymbols.warning} No sandbox populators found. Create .populator.ts files under ${chalk.cyan(`${this.cfg.root}/populators/sandbox/`)}.`,
      );
      process.exit(0);
    }

    this.log("");

    const chosen = await select<Populator>({
      message: "Select a sandbox populator to run:",
      choices: sandboxPopulators.map((p) => ({ name: p.name, value: p })),
    });

    let sandboxSpin!: ReturnType<typeof ora>;

    const sandboxResult = await runPopulators([chosen], {
      onStart: (name) => {
        sandboxSpin = ora({
          text: `${chalk.dim("[sandbox]")} ${name}`,
          spinner: "dots",
        }).start();
      },
      onDone: (name) => {
        sandboxSpin.succeed(`${chalk.dim("[sandbox]")} ${name}`);
      },
    });

    if (!sandboxResult.ok) {
      if (sandboxSpin?.isSpinning) {
        sandboxSpin.fail(`${sandboxSpin.text} failed`);
        process.stderr.write(`${chalk.red(sandboxResult.message)}\n`);
      } else {
        process.stderr.write(`${logSymbols.error} ${sandboxResult.message}\n`);
      }
      process.exit(1);
    }

    this.log(`\n${logSymbols.success} ${chalk.green("Sandbox ready.")}`);
    process.exit(0);
  }
}
