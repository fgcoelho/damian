import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverPopulators } from "../src/commands/populate.js";
import type { DamianConfig } from "../src/config.js";

function makeConfig(root: string): DamianConfig {
  return { driver: "postgres", root, env: ".env", url: undefined };
}

describe("discoverPopulators()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "damian-pop-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when populators directory does not exist", async () => {
    const cfg = makeConfig(tmpDir);
    const result = await discoverPopulators(cfg);
    expect(result).toEqual([]);
  });

  it("returns empty array when populators directory is empty", async () => {
    const populatorsDir = path.join(tmpDir, "populators");
    fs.mkdirSync(populatorsDir, { recursive: true });
    const cfg = makeConfig(tmpDir);
    const result = await discoverPopulators(cfg);
    expect(result).toEqual([]);
  });

  it("discovers a populator file in a group subdirectory", async () => {
    const populatorsDir = path.join(tmpDir, "populators");
    fs.mkdirSync(path.join(populatorsDir, "seeds"), { recursive: true });
    fs.writeFileSync(
      path.join(populatorsDir, "seeds", "users.populator.ts"),
      "",
    );

    const cfg = makeConfig(tmpDir);
    const result = await discoverPopulators(cfg);

    expect(result).toHaveLength(1);
    expect(result[0].group).toBe("seeds");
    expect(result[0].name).toBe("users");
  });

  it("assigns group 'default' for top-level populator files", async () => {
    const populatorsDir = path.join(tmpDir, "populators");
    fs.mkdirSync(populatorsDir, { recursive: true });
    fs.writeFileSync(path.join(populatorsDir, "all.populator.ts"), "");

    const cfg = makeConfig(tmpDir);
    const result = await discoverPopulators(cfg);

    expect(result).toHaveLength(1);
    expect(result[0].group).toBe("default");
    expect(result[0].name).toBe("all");
  });

  it("returns results sorted alphabetically by filepath", async () => {
    const populatorsDir = path.join(tmpDir, "populators");
    fs.mkdirSync(path.join(populatorsDir, "group"), { recursive: true });
    fs.writeFileSync(
      path.join(populatorsDir, "group", "beta.populator.ts"),
      "",
    );
    fs.writeFileSync(
      path.join(populatorsDir, "group", "alpha.populator.ts"),
      "",
    );

    const cfg = makeConfig(tmpDir);
    const result = await discoverPopulators(cfg);

    expect(result[0].name).toBe("alpha");
    expect(result[1].name).toBe("beta");
  });

  it("includes the absolute filepath", async () => {
    const populatorsDir = path.join(tmpDir, "populators");
    fs.mkdirSync(path.join(populatorsDir, "g"), { recursive: true });
    const file = path.join(populatorsDir, "g", "foo.populator.ts");
    fs.writeFileSync(file, "");

    const cfg = makeConfig(tmpDir);
    const result = await discoverPopulators(cfg);

    expect(result[0].filepath).toBe(file);
  });
});
