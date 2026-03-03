import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { createJiti } from "jiti";
import { POPULATOR_BRAND, type PopulatorInstance } from "../populator.js";
import { getTsconfigAliases } from "../utils/tsconfig.js";

export interface PopulateWorkerInput {
  filepaths: string[];
  cwd: string;
}

export type PopulateWorkerMessage =
  | { type: "validated" }
  | { type: "start"; name: string }
  | { type: "done"; name: string }
  | { type: "error"; name: string; message: string }
  | { type: "finished" };

const { filepaths, cwd } = workerData as PopulateWorkerInput;

function nameOf(filepath: string): string {
  return path.basename(filepath, ".populator.ts");
}

function topoSort(names: string[], deps: Map<string, string[]>): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    for (const dep of deps.get(name) ?? []) {
      if (!names.includes(dep)) {
        throw new Error(
          `Populator "${name}" depends on "${dep}" which is not in the selected set.`,
        );
      }
      visit(dep);
    }
    result.push(name);
  }

  for (const name of names) {
    visit(name);
  }

  return result;
}

async function run() {
  const jiti = createJiti(import.meta.url, {
    alias: getTsconfigAliases(cwd),
    jsx: true,
  });

  const entries = await Promise.all(
    filepaths.map(async (filepath) => {
      const mod = await jiti.import(filepath);
      return { name: nameOf(filepath), mod };
    }),
  );

  for (const { name, mod } of entries) {
    const def = (mod as { default?: unknown }).default;
    if (
      typeof def !== "object" ||
      def === null ||
      !(POPULATOR_BRAND in def) ||
      (def as Record<string, unknown>)[POPULATOR_BRAND] !== true
    ) {
      parentPort?.postMessage({
        type: "error",
        name,
        message: `${name}.populator.ts does not export a default populator() instance.`,
      } satisfies PopulateWorkerMessage);
      return;
    }
  }

  const instances = entries.map(({ name, mod }) => ({
    name,
    instance: (mod as { default: PopulatorInstance }).default,
  }));

  const byName = new Map(instances.map((e) => [e.name, e.instance]));
  const deps = new Map(instances.map((e) => [e.name, e.instance.dependsOn]));

  let order: string[];
  try {
    order = topoSort([...byName.keys()], deps);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    parentPort?.postMessage({
      type: "error",
      name: "",
      message,
    } satisfies PopulateWorkerMessage);
    return;
  }

  parentPort?.postMessage({
    type: "validated",
  } satisfies PopulateWorkerMessage);

  for (const name of order) {
    const instance = byName.get(name) as PopulatorInstance;
    parentPort?.postMessage({
      type: "start",
      name,
    } satisfies PopulateWorkerMessage);
    try {
      await instance.populate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      parentPort?.postMessage({
        type: "error",
        name,
        message,
      } satisfies PopulateWorkerMessage);
      return;
    }
    parentPort?.postMessage({
      type: "done",
      name,
    } satisfies PopulateWorkerMessage);
  }

  parentPort?.postMessage({ type: "finished" } satisfies PopulateWorkerMessage);
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  parentPort?.postMessage({
    type: "error",
    name: "",
    message,
  } satisfies PopulateWorkerMessage);
});
