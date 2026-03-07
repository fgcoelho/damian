import { execFileSync } from "node:child_process";
import path from "node:path";
import { checkbox } from "@inquirer/prompts";
import chalk from "chalk";
import logSymbols from "log-symbols";
import ora from "ora";
import { BaseCommand } from "../base";
import { buildDbmateEnv, dbmateBin } from "../core/dbmate";
import {
  discoverPopulators,
  type PopulatorMeta,
  runPopulators,
} from "../core/populate/runner";
import {
  partitionPopulators,
  resolveSelectedSandboxPopulators,
} from "../core/sandbox";
import { resetDatabase } from "../utils/reset";
import Generate from "./generate";
import { handlePopulatorFailure } from "./populate";

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

    await this.resetAndMigrate(cwd);
    await Generate.run(this.argv, this.config);

    const allPopulators = await discoverPopulators(this.cfg);
    const { core, sandbox } = partitionPopulators(allPopulators);

    if (core.length > 0) {
      await this.runCorePopulators(core);
    }

    if (sandbox.length === 0) {
      this.log(
        `${logSymbols.warning} No sandbox populators found. Create .populator.ts files under ${chalk.cyan(`${this.cfg.root}/populators/sandbox/`)}.`,
      );
      process.exit(0);
    }

    const chosen = await this.promptSandboxSelection(sandbox);

    if (chosen.length === 0) {
      this.log(`${logSymbols.info} No sandbox populators selected.`);
      process.exit(0);
    }

    await this.runSandboxPopulators(chosen);

    this.log(`${logSymbols.success} ${chalk.green("Sandbox ready.")}`);
    process.exit(0);
  }

  private async resetAndMigrate(cwd: string): Promise<void> {
    let spin = ora({ text: "Resetting database...", spinner: "dots" }).start();
    await resetDatabase(this.cfg.url as string);
    spin.succeed("Database reset.");

    const migrationsDir = path.resolve(cwd, this.cfg.root, ".migrations");
    spin = ora({ text: "Running migrations...", spinner: "dots" }).start();
    execFileSync(dbmateBin(), ["migrate"], {
      stdio: "pipe",
      env: buildDbmateEnv(this.cfg, migrationsDir),
    });
    spin.succeed("Migrations applied.");
  }

  private async runCorePopulators(core: PopulatorMeta[]): Promise<void> {
    const spin = ora({
      text: `Validating ${core.length} core populator(s)...`,
      spinner: "dots",
    }).start();

    const spinners = new Map<string, ReturnType<typeof ora>>();

    const result = await runPopulators(core, {
      onValidated: () => {
        spin.succeed(`Validated ${core.length} core populator(s).`);
      },
      onStart: (name) => {
        spinners.set(
          name,
          ora({
            text: `${chalk.dim("[core]")} ${name}`,
            spinner: "dots",
          }).start(),
        );
      },
      onDone: (name) => {
        spinners.get(name)?.succeed(`${chalk.dim("[core]")} ${name}`);
      },
    });

    if (!result.ok) {
      handlePopulatorFailure(
        result as { ok: false; message: string; name?: string },
        spinners,
        spin,
      );
      process.exit(1);
    }
  }

  private async promptSandboxSelection(
    sandbox: PopulatorMeta[],
  ): Promise<PopulatorMeta[]> {
    const selectedNames = await checkbox<string>({
      message: "Select sandbox populators to run:",
      choices: sandbox.map((p) => ({ name: p.name, value: p.name })),
    });
    return resolveSelectedSandboxPopulators(sandbox, selectedNames);
  }

  private async runSandboxPopulators(chosen: PopulatorMeta[]): Promise<void> {
    const spin = ora({
      text: `Validating ${chosen.length} sandbox populator(s)...`,
      spinner: "dots",
    }).start();

    const spinners = new Map<string, ReturnType<typeof ora>>();

    const result = await runPopulators(chosen, {
      onValidated: () => {
        spin.succeed(`Validated ${chosen.length} sandbox populator(s).`);
      },
      onStart: (name) => {
        spinners.set(
          name,
          ora({
            text: `${chalk.dim("[sandbox]")} ${name}`,
            spinner: "dots",
          }).start(),
        );
      },
      onDone: (name) => {
        spinners.get(name)?.succeed(`${chalk.dim("[sandbox]")} ${name}`);
      },
    });

    if (!result.ok) {
      handlePopulatorFailure(
        result as { ok: false; message: string; name?: string },
        spinners,
        spin,
      );
      process.exit(1);
    }
  }
}
