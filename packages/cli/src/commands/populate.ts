import path from "node:path";
import { Worker } from "node:worker_threads";
import { checkbox, select } from "@inquirer/prompts";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import { glob } from "glob";
import logSymbols from "log-symbols";
import ora from "ora";
import { BaseCommand } from "../base.js";
import type { DamianConfig } from "../config.js";
import type {
  PopulateWorkerInput,
  PopulateWorkerMessage,
} from "../workers/populate.js";

export type Populator = { group: string; name: string; filepath: string };

export async function discoverPopulators(
  cfg: DamianConfig,
): Promise<Populator[]> {
  const cwd = process.cwd();
  const populatorsRoot = path.resolve(cwd, cfg.root, "populators");

  const files = await glob("**/*.populator.ts", {
    cwd: populatorsRoot,
    absolute: true,
  });

  return files.sort().map((filepath) => {
    const rel = path.relative(populatorsRoot, filepath);
    const parts = rel.split(path.sep);
    const group = parts.length > 1 ? parts[0] : "default";
    const name = path.basename(filepath, ".populator.ts");

    return { group, name, filepath };
  });
}

export type RunPopulatorsResult =
  | { ok: true }
  | { ok: false; message: string; name?: string };

export interface RunPopulatorsOptions {
  onStart: (name: string) => void;
  onDone: (name: string) => void;
  onValidated?: () => void;
}

export function runPopulators(
  populators: Populator[],
  options: RunPopulatorsOptions,
): Promise<RunPopulatorsResult> {
  const { onStart, onDone, onValidated } = options;
  const cwd = process.cwd();
  const workerFile = path.join(__dirname, "populate.cjs");
  const workerInput: PopulateWorkerInput = {
    filepaths: populators.map((p) => p.filepath),
    cwd,
  };

  return new Promise<RunPopulatorsResult>((resolve) => {
    const worker = new Worker(workerFile, { workerData: workerInput });

    worker.on("message", (msg: PopulateWorkerMessage) => {
      if (msg.type === "validated") {
        onValidated?.();
      } else if (msg.type === "start") {
        onStart(msg.name);
      } else if (msg.type === "done") {
        onDone(msg.name);
      } else if (msg.type === "finished") {
        resolve({ ok: true });
      } else if (msg.type === "error") {
        resolve({ ok: false, message: msg.message, name: msg.name });
      }
    });

    worker.once("error", (err: Error) => {
      resolve({ ok: false, message: err.message });
    });
  });
}

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

    let selected: Populator[];

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
      selected = await checkbox<Populator>({
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
