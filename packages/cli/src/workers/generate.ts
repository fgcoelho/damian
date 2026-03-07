import { workerData } from "node:worker_threads";
import { type GenerateWorkerInput, run } from "../core/generate/worker";

run(workerData as GenerateWorkerInput).catch((err: unknown) => {
  throw err;
});
