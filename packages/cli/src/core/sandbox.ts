import type { PopulatorMeta } from "./populate/runner";

export type PartitionedPopulators = {
  core: PopulatorMeta[];
  sandbox: PopulatorMeta[];
};

export function partitionPopulators(
  all: PopulatorMeta[],
): PartitionedPopulators {
  return {
    core: all.filter((p) => p.group === "core"),
    sandbox: all.filter((p) => p.group === "sandbox"),
  };
}

export function resolveSelectedSandboxPopulators(
  available: PopulatorMeta[],
  selectedNames: string[],
): PopulatorMeta[] {
  const nameSet = new Set(selectedNames);
  return available.filter((p) => nameSet.has(p.name));
}
