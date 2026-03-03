/** biome-ignore-all lint/style/noNonNullAssertion: ! */
import type { DatabasePool } from "@damiandb/pg";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

let stablePool: DatabasePool | undefined;

vi.mock("@damiandb/pg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@damiandb/pg")>();
  const { PGlite } = await import("@electric-sql/pglite");
  const { createPGLiteDriverFactory } = await import("slonik-pglite-driver");

  type PGliteParam = Parameters<typeof createPGLiteDriverFactory>[0];

  return {
    ...actual,
    createDb: async () => {
      if (!stablePool) {
        const pg = new PGlite();
        const driverFactory = createPGLiteDriverFactory(
          pg as unknown as PGliteParam,
        );
        stablePool = await actual.createDb({
          connectionString: "postgres://",
          driverFactory,
        });
      }
      return { ...stablePool, end: async () => {} };
    },
  };
});

const { resetDatabase } = await import("../src/utils/reset.js");
const { sql } = await import("@damiandb/pg");

describe("resetDatabase()", () => {
  it("resolves without error on a fresh database", async () => {
    stablePool = undefined;
    await expect(resetDatabase("postgres://unused")).resolves.toBeUndefined();
  });

  it("drops non-system schemas and recreates public", async () => {
    stablePool = undefined;

    await resetDatabase("postgres://unused");

    const pool = stablePool!;

    await pool.transaction(async (tx) => {
      await tx.query(sql.void`CREATE SCHEMA myapp`);
      await tx.query(sql.void`CREATE TABLE myapp.items (id int)`);
    });

    await resetDatabase("postgres://unused");

    const schemaRow = z.object({ schema_name: z.string() }).strict();
    const result = await pool.query(
      sql(schemaRow)`
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
          AND schema_name NOT LIKE 'pg_%'
      `,
    );

    const names = result.rows.map((r) => r.schema_name);
    expect(names).toContain("public");
    expect(names).not.toContain("myapp");
    await pool.end();
  });
});
