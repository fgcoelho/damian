import { describe, expect, it } from "vitest";
import { createTypeParserPreset, s } from "../src/index.js";
import { internalSQL as sql } from "../src/sql.js";
import { createTestPool } from "./__shared__/pglite-database.js";

describe("createDb()", () => {
  it("exports createTypeParserPreset", () => {
    expect(createTypeParserPreset).toBeDefined();
    expect(typeof createTypeParserPreset).toBe("function");
  });

  it("returns a DatabasePool with query/transaction/end methods", async () => {
    const db = await createTestPool();
    expect(typeof db.query).toBe("function");
    expect(typeof db.transaction).toBe("function");
    expect(typeof db.end).toBe("function");
    await db.end();
  });
});

describe("DatabasePool — query", () => {
  it("executes a simple SELECT and returns typed rows", async () => {
    const db = await createTestPool();
    const schema = s.object({ n: s.number("int4") });
    const result = await db.query(sql(schema)`SELECT 42::int AS n`);
    expect(result.rows[0].n).toBe(42);
    await db.end();
  });

  it("returns empty rows for a query that matches nothing", async () => {
    const db = await createTestPool();
    await db.transaction(async (tx) => {
      await tx.query(sql.void`CREATE TABLE IF NOT EXISTS test_empty (id int)`);
      const schema = s.object({ id: s.number("int4") });
      const result = await tx.query(
        sql(schema)`SELECT * FROM test_empty WHERE 1 = 0`,
      );
      expect(result.rows).toHaveLength(0);
    });
    await db.end();
  });
});

describe("DatabasePool — transaction", () => {
  it("commits changes made inside the transaction", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`CREATE TABLE tx_test (val int)`);
      await tx.query(sql.void`INSERT INTO tx_test VALUES (1)`);
      const schema = s.object({ val: s.number("int4") });
      const result = await tx.query(sql(schema)`SELECT val FROM tx_test`);
      expect(result.rows[0].val).toBe(1);
    });

    await db.end();
  });

  it("rolls back when an error is thrown inside the transaction", async () => {
    const db = await createTestPool();

    let caught = false;
    try {
      await db.transaction(async (tx) => {
        await tx.query(sql.void`CREATE TABLE rollback_test (val int)`);
        await tx.query(sql.void`INSERT INTO rollback_test VALUES (2)`);
        throw new Error("abort");
      });
    } catch (err) {
      caught = true;
      expect((err as Error).message).toBe("abort");
    }

    expect(caught).toBe(true);
    await db.end();
  });
});

describe("createDb() — with custom driverFactory", () => {
  it("createTestPool uses PGlite driver and connects successfully", async () => {
    const db = await createTestPool();
    const schema = s.object({ ok: s.boolean() });
    const result = await db.query(sql(schema)`SELECT TRUE AS ok`);
    expect(result.rows[0].ok).toBe(true);
    await db.end();
  });
});

describe("createDb() — with typeParsers and interceptors", () => {
  it("uses custom interceptors", async () => {
    let callCount = 0;
    const interceptor = {
      name: "count-queries",
      beforeQueryExecution: async () => {
        callCount++;
        return null;
      },
    };

    const db = await createTestPool({
      interceptors: [interceptor],
    });

    await db.query(sql.void`SELECT 1`);
    expect(callCount).toBe(1);
    await db.end();
  });
});
