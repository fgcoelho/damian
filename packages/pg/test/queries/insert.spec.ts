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

describe("INSERT INTO", () => {
  it()
    .should("insert a single row using createRow + sql.tuple")
    .test(async () => {
      const { cols, row } = UserTable.createRow({
        id: 100,
        name: "Alice",
        email: "alice@example.com",
      });
      await db.query(
        sql.void`INSERT INTO users ${sql.tuple(cols)} VALUES ${sql.tuple(row)}`,
      );
      const result = await db.query(
        sql(UserTable)`SELECT * FROM users WHERE id = ${100}`,
      );
      expect(result.rows[0].name).toBe("Alice");
    });

  it()
    .should("insert multiple rows using createRows + sql.tuples")
    .test(async () => {
      const { cols, rows } = UserTable.createRows([
        { id: 101, name: "Alice", email: "alice101@example.com" },
        { id: 102, name: "Bob", email: "bob102@example.com" },
        { id: 103, name: "Carol", email: "carol103@example.com" },
      ]);
      await db.query(
        sql.void`INSERT INTO users ${sql.tuple(cols)} VALUES ${sql.tuples(rows)}`,
      );
      const { rows: countRows } = await db.query(
        sql(
          CountSchema,
        )`SELECT COUNT(*)::int AS n FROM users WHERE id IN (101, 102, 103)`,
      );
      expect(countRows[0].n).toBe(3);
    });

  it()
    .should("insert multiple rows using createRows + sql.join.comma(sql.tuple)")
    .test(async () => {
      const { cols, rows } = UserTable.createRows([
        { id: 104, name: "Alice", email: "alice104@example.com" },
        { id: 105, name: "Bob", email: "bob105@example.com" },
      ]);
      await db.query(
        sql.void`INSERT INTO users ${sql.tuple(cols)} VALUES ${sql.join.comma(rows.map((row) => sql.tuple(row)))}`,
      );
      const { rows: countRows } = await db.query(
        sql(
          CountSchema,
        )`SELECT COUNT(*)::int AS n FROM users WHERE id IN (104, 105)`,
      );
      expect(countRows[0].n).toBe(2);
    });
});
