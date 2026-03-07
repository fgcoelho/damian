import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { createJiti } from "jiti";
import { topoSort } from "../core/populate/topo-sort";
import { POPULATOR_BRAND, type PopulatorInstance } from "../populator";
import { getTsconfigAliases } from "../utils/tsconfig";

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

function sendError(name: string, message: string): void {
  parentPort?.postMessage({
    type: "error",
    name,
    message,
  } satisfies PopulateWorkerMessage);
}

type PopulatorEntry = { name: string; mod: unknown };
type PopulatorInstance_ = { name: string; instance: PopulatorInstance };

async function loadEntries(): Promise<PopulatorEntry[]> {
  const jiti = createJiti(import.meta.url, {
    alias: getTsconfigAliases(cwd),
    jsx: true,
  });

  return Promise.all(
    filepaths.map(async (filepath) => {
      const mod = await jiti.import(filepath);
      return { name: nameOf(filepath), mod };
    }),
  );
}

function validatePopulators(entries: PopulatorEntry[]): boolean {
  for (const { name, mod } of entries) {
    const def = (mod as { default?: unknown }).default;
    if (
      typeof def !== "object" ||
      def === null ||
      !(POPULATOR_BRAND in def) ||
      (def as Record<string, unknown>)[POPULATOR_BRAND] !== true
    ) {
      sendError(
        name,
        `${name}.populator.ts does not export a default populator() instance.`,
      );
      return false;
    }
  }
  return true;
}

async function executePopulators(
  order: string[],
  byName: Map<string, PopulatorInstance>,
): Promise<boolean> {
  for (const name of order) {
    // biome-ignore lint/style/noNonNullAssertion: order comes from byName.keys()
    const instance = byName.get(name)!;
    parentPort?.postMessage({
      type: "start",
      name,
    } satisfies PopulateWorkerMessage);
    try {
      await instance.populate();
    } catch (err: unknown) {
      sendError(name, err instanceof Error ? err.message : String(err));
      return false;
    }
    parentPort?.postMessage({
      type: "done",
      name,
    } satisfies PopulateWorkerMessage);
  }
  return true;
}

async function run() {
  const entries = await loadEntries();

  if (!validatePopulators(entries)) return;

  const instances: PopulatorInstance_[] = entries.map(({ name, mod }) => ({
    name,
    instance: (mod as { default: PopulatorInstance }).default,
  }));

  const byName = new Map(instances.map((e) => [e.name, e.instance]));
  const deps = new Map(instances.map((e) => [e.name, e.instance.dependsOn]));

  let order: string[];
  try {
    order = topoSort([...byName.keys()], deps);
  } catch (err: unknown) {
    sendError("", err instanceof Error ? err.message : String(err));
    return;
  }

  parentPort?.postMessage({
    type: "validated",
  } satisfies PopulateWorkerMessage);

  const succeeded = await executePopulators(order, byName);
  if (succeeded) {
    parentPort?.postMessage({
      type: "finished",
    } satisfies PopulateWorkerMessage);
  }
}

run().catch((err: unknown) => {
  sendError("", err instanceof Error ? err.message : String(err));
});
