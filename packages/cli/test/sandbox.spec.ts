import { describe, expect, it } from "vitest";
import type { PopulatorMeta } from "../src/core/populate/runner";
import {
  partitionPopulators,
  resolveSelectedSandboxPopulators,
} from "../src/core/sandbox";

function makePopulator(group: string, name: string): PopulatorMeta {
  return { group, name, filepath: `/fake/${group}/${name}.populator.ts` };
}

describe("partitionPopulators()", () => {
  it("separates core and sandbox populators", () => {
    const all = [
      makePopulator("core", "seed"),
      makePopulator("sandbox", "user"),
      makePopulator("sandbox", "admin"),
    ];

    const { core, sandbox } = partitionPopulators(all);

    expect(core).toHaveLength(1);
    expect(core[0].name).toBe("seed");
    expect(sandbox).toHaveLength(2);
    expect(sandbox.map((p) => p.name)).toEqual(["user", "admin"]);
  });

  it("returns empty core when no core populators exist", () => {
    const all = [makePopulator("sandbox", "user")];
    const { core } = partitionPopulators(all);
    expect(core).toHaveLength(0);
  });

  it("returns empty sandbox when no sandbox populators exist", () => {
    const all = [makePopulator("core", "seed")];
    const { sandbox } = partitionPopulators(all);
    expect(sandbox).toHaveLength(0);
  });

  it("returns both empty when list is empty", () => {
    const { core, sandbox } = partitionPopulators([]);
    expect(core).toHaveLength(0);
    expect(sandbox).toHaveLength(0);
  });
});

describe("resolveSelectedSandboxPopulators()", () => {
  const available = [
    makePopulator("sandbox", "user"),
    makePopulator("sandbox", "admin"),
    makePopulator("sandbox", "guest"),
  ];

  it("returns only the populators whose names appear in the selection", () => {
    const selected = resolveSelectedSandboxPopulators(available, [
      "user",
      "admin",
    ]);
    expect(selected.map((p) => p.name)).toEqual(["user", "admin"]);
  });

  it("returns all available when all names are selected", () => {
    const selected = resolveSelectedSandboxPopulators(available, [
      "user",
      "admin",
      "guest",
    ]);
    expect(selected).toHaveLength(3);
  });

  it("returns empty array when selection is empty", () => {
    const selected = resolveSelectedSandboxPopulators(available, []);
    expect(selected).toHaveLength(0);
  });
});
