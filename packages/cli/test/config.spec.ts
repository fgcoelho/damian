import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config, loadConfig, loadEnv } from "../src/config.js";

describe("config()", () => {
  it("applies defaults for all omitted fields", () => {
    const result = config({});
    expect(result.driver).toBe("postgres");
    expect(result.root).toBe("./damian");
    expect(result.env).toBe(".env");
    expect(result.devDumpIgnore).toEqual([]);
  });

  it("uses provided values when supplied", () => {
    const result = config({
      driver: "postgres",
      root: "./custom",
      env: ".env.prod",
      url: "postgres://localhost/mydb",
      devDumpIgnore: ["seed.sql"],
    });
    expect(result.driver).toBe("postgres");
    expect(result.root).toBe("./custom");
    expect(result.env).toBe(".env.prod");
    expect(result.url).toBe("postgres://localhost/mydb");
    expect(result.devDumpIgnore).toEqual(["seed.sql"]);
  });

  it("falls back to DATABASE_URL env var when url is not provided", () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://env/db";
    const result = config({});
    expect(result.url).toBe("postgres://env/db");
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
  });

  it("url is undefined when not provided and DATABASE_URL is not set", () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const result = config({});
    expect(result.url).toBeUndefined();
    if (original !== undefined) {
      process.env.DATABASE_URL = original;
    }
  });
});

describe("loadConfig()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "damian-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws when config file does not exist", async () => {
    const missing = path.join(tmpDir, "damian.config.ts");
    await expect(loadConfig(missing)).rejects.toThrow("Config file not found");
  });
});

describe("loadEnv()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "damian-env-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does nothing when the env file does not exist", () => {
    const before = { ...process.env };
    loadEnv(path.join(tmpDir, ".env.missing"));
    expect(process.env).toEqual(before);
  });

  it("sets env vars from a simple .env file", () => {
    const envFile = path.join(tmpDir, ".env");
    fs.writeFileSync(envFile, "TEST_VAR_A=hello\nTEST_VAR_B=world\n");
    delete process.env.TEST_VAR_A;
    delete process.env.TEST_VAR_B;
    loadEnv(envFile);
    expect(process.env.TEST_VAR_A).toBe("hello");
    expect(process.env.TEST_VAR_B).toBe("world");
    delete process.env.TEST_VAR_A;
    delete process.env.TEST_VAR_B;
  });

  it("strips surrounding quotes from values", () => {
    const envFile = path.join(tmpDir, ".env");
    fs.writeFileSync(
      envFile,
      "TEST_QUOTED=\"quoted value\"\nTEST_SINGLE='single'\n",
    );
    delete process.env.TEST_QUOTED;
    delete process.env.TEST_SINGLE;
    loadEnv(envFile);
    expect(process.env.TEST_QUOTED).toBe("quoted value");
    expect(process.env.TEST_SINGLE).toBe("single");
    delete process.env.TEST_QUOTED;
    delete process.env.TEST_SINGLE;
  });

  it("skips comment lines and blank lines", () => {
    const envFile = path.join(tmpDir, ".env");
    fs.writeFileSync(envFile, "# this is a comment\n\nTEST_SKIP_VAR=yes\n");
    delete process.env.TEST_SKIP_VAR;
    loadEnv(envFile);
    expect(process.env.TEST_SKIP_VAR).toBe("yes");
    delete process.env.TEST_SKIP_VAR;
  });

  it("does not overwrite already-set env vars", () => {
    const envFile = path.join(tmpDir, ".env");
    fs.writeFileSync(envFile, "TEST_NO_OVERWRITE=new\n");
    process.env.TEST_NO_OVERWRITE = "existing";
    loadEnv(envFile);
    expect(process.env.TEST_NO_OVERWRITE).toBe("existing");
    delete process.env.TEST_NO_OVERWRITE;
  });

  it("handles values containing '=' characters", () => {
    const envFile = path.join(tmpDir, ".env");
    fs.writeFileSync(envFile, "TEST_EQ_VAL=a=b=c\n");
    delete process.env.TEST_EQ_VAL;
    loadEnv(envFile);
    expect(process.env.TEST_EQ_VAL).toBe("a=b=c");
    delete process.env.TEST_EQ_VAL;
  });
});
