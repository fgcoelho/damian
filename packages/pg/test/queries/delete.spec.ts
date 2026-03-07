import { afterAll, beforeAll, describe, expect } from "vitest";
import { s } from "../../src/index";
import { table } from "../../src/table";
import { createTestPool } from "../__shared__/database";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

const UserTable = table("public", "users", {
  id: s.number("int4"),
  name: s.string("text"),
  email: s.string("text"),
});

const CountSchema = s.object({ n: s.number("int4") });

let db: Awaited<ReturnType<typeof createTestPool>>;

beforeAll(async () => {
  db = await createTestPool();
  await db.query(sql.void`
    CREATE TABLE users (
      id    serial PRIMARY KEY,
      name  text NOT NULL,
      email text NOT NULL UNIQUE
    )
  `);
});

afterAll(async () => {
  await db.end();
});

describe("DELETE FROM", () => {
  it()
    .should("remove a matching row so it no longer appears in SELECT")
    .test(async () => {
      await db.query(
        sql.void`INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com'), (2, 'Bob', 'bob@example.com')`,
      );
      await db.query(
        sql.void`DELETE FROM ${UserTable} WHERE ${UserTable.name} = ${"Alice"}`,
      );
      const result = await db.query(sql(UserTable)`SELECT * FROM ${UserTable}`);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Bob");
    });

  it()
    .should("remove all rows when no WHERE clause is given")
    .test(async () => {
      await db.query(
        sql.void`INSERT INTO users (id, name, email) VALUES (3, 'Carol', 'carol@example.com'), (4, 'Dave', 'dave@example.com')`,
      );
      await db.query(sql.void`DELETE FROM ${UserTable}`);
      const { rows } = await db.query(
        sql(CountSchema)`SELECT COUNT(*)::int AS n FROM users`,
      );
      expect(rows[0].n).toBe(0);
    });
});
