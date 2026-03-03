import { checkbox, select } from "@inquirer/prompts";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import logSymbols from "log-symbols";
import ora from "ora";
import { BaseCommand } from "../base.js";
import {
  discoverPopulators,
  type PopulatorMeta,
  type PopulatorRunResult,
  runPopulators,
} from "../core/populate/runner.js";

export type Populator = PopulatorMeta;

export function handlePopulatorFailure(
  result: { ok: false; message: string; name?: string },
  spinners: Map<string, ReturnType<typeof ora>>,
  fallbackSpinner?: ReturnType<typeof ora>,
): void {
  const active =
    (result.name ? spinners.get(result.name) : undefined) ??
    [...spinners.values()].find((s) => s.isSpinning);

  if (active) {
    active.fail(`${active.text} failed`);
    process.stderr.write(`${chalk.red(result.message)}\n`);
  } else if (fallbackSpinner) {
    fallbackSpinner.fail(result.message);
  } else {
    process.stderr.write(`${logSymbols.error} ${result.message}\n`);
  }
}

export { discoverPopulators, runPopulators };
export type { PopulatorRunResult };

export default class Populate extends BaseCommand<typeof Populate> {
  static description = "Run database populators";

  static flags = {
    group: Flags.string({
      char: "g",
      description: "Populator group to run",
      required: false,
    }),
    populator: Flags.string({
      char: "p",
      description: "Specific populator name to run (requires --group)",
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Populate);
    const allPopulators = await discoverPopulators(this.cfg);

    if (allPopulators.length === 0) {
      this.log(
        `${logSymbols.warning} No populator files found.\nCreate .populator.ts files under ${chalk.cyan(`${this.cfg.root}/populators/{group}/`)} in your project.`,
      );
      return;
    }

    const groups = [...new Set(allPopulators.map((p) => p.group))].sort();

    let selectedGroup: string;

    if (flags.group) {
      if (!groups.includes(flags.group)) {
        this.error(
          `Group "${flags.group}" not found. Available groups: ${groups.join(", ")}`,
        );
      }
      selectedGroup = flags.group;
    } else {
      selectedGroup = await select<string>({
        message: "Select a populator group:",
        choices: groups.map((g) => ({ name: g, value: g })),
      });
    }

    const inGroup = allPopulators.filter((p) => p.group === selectedGroup);

    let selected: PopulatorMeta[];

    if (flags.group && flags.populator) {
      const match = inGroup.find((p) => p.name === flags.populator);
      if (!match) {
        this.error(
          `Populator "${flags.populator}" not found in group "${selectedGroup}". Available: ${inGroup.map((p) => p.name).join(", ")}`,
        );
      }
      selected = [match];
    } else if (flags.group) {
      selected = inGroup;
    } else {
      selected = await checkbox<PopulatorMeta>({
        message: `Select populators to run from [${chalk.cyan(selectedGroup)}]:`,
        choices: inGroup.map((p) => ({ name: p.name, value: p })),
      });
    }

    if (selected.length === 0) {
      this.log(`${logSymbols.info} No populators selected.`);
      process.exit(0);
    }

    const loadSpin = ora({
      text: `Validating ${selected.length} populator(s)...`,
      spinner: "dots",
    }).start();

    const groupOf = new Map(selected.map((p) => [p.name, p.group]));
    const spinners = new Map<string, ReturnType<typeof ora>>();

    const result = await runPopulators(selected, {
      onValidated: () => {
        loadSpin.succeed(`Validated ${selected.length} populator(s).`);
      },
      onStart: (name) => {
        spinners.set(
          name,
          ora({
            text: `${chalk.dim(`[${groupOf.get(name)}]`)} ${name}`,
            spinner: "dots",
          }).start(),
        );
      },
      onDone: (name) => {
        spinners
          .get(name)
          ?.succeed(`${chalk.dim(`[${groupOf.get(name)}]`)} ${name}`);
      },
    });

    if (!result.ok) {
      const active =
        (result.name ? spinners.get(result.name) : undefined) ??
        [...spinners.values()].find((s) => s.isSpinning);

      if (active) {
        active.fail(`${active.text} failed`);
        process.stderr.write(`${chalk.red(result.message)}\n`);
      } else {
        loadSpin.fail(result.message);
      }
      process.exit(1);
    }

    this.log(
      `\n${logSymbols.success} Populated ${chalk.cyan(String(selected.length))} populator(s).`,
    );

    process.exit(0);
  }
}
