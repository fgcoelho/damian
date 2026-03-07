import path from "node:path";
import { Worker } from "node:worker_threads";
import { glob } from "glob";
import type { DamianConfig } from "../config";

export type PopulatorMeta = {
  group: string;
  name: string;
  filepath: string;
};

export type PopulatorRunResult =
  | { ok: true }
  | { ok: false; message: string; name?: string };

export type PopulatorRunCallbacks = {
  onValidated?: () => void;
  onStart: (name: string) => void;
  onDone: (name: string) => void;
};

export async function discoverPopulators(
  cfg: DamianConfig,
): Promise<PopulatorMeta[]> {
  const populatorsRoot = path.resolve(process.cwd(), cfg.root, "populators");

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

export function runPopulators(
  populators: PopulatorMeta[],
  callbacks: PopulatorRunCallbacks,
): Promise<PopulatorRunResult> {
  const workerFile = path.join(__dirname, "populate.cjs");
  const workerInput = {
    filepaths: populators.map((p) => p.filepath),
    cwd: process.cwd(),
  };

  return new Promise<PopulatorRunResult>((resolve) => {
    const worker = new Worker(workerFile, { workerData: workerInput });

    worker.on(
      "message",
      (msg: { type: string; name?: string; message?: string }) => {
        if (msg.type === "validated") {
          callbacks.onValidated?.();
        } else if (msg.type === "start" && msg.name) {
          callbacks.onStart(msg.name);
        } else if (msg.type === "done" && msg.name) {
          callbacks.onDone(msg.name);
        } else if (msg.type === "finished") {
          resolve({ ok: true });
        } else if (msg.type === "error") {
          resolve({
            ok: false,
            message: msg.message ?? "Unknown error",
            name: msg.name,
          });
        }
      },
    );

    worker.once("error", (err: Error) => {
      resolve({ ok: false, message: err.message });
    });
  });
}
