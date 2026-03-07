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
  await db.query(
    sql.void`INSERT INTO users (name, email) VALUES
      ('Carol', 'c@x.com'),
      ('Alice', 'a@x.com'),
      ('Bob',   'b@x.com')`,
  );
});

afterAll(async () => {
  await db.end();
});

describe("ORDER BY", () => {
  it()
    .should("sort rows ascending by a column")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} ORDER BY ${UserTable.name} ASC`,
      );
      expect(result.rows.map((r) => r.name)).toEqual(["Alice", "Bob", "Carol"]);
    });

  it()
    .should("sort rows descending by a column")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} ORDER BY ${UserTable.name} DESC`,
      );
      expect(result.rows.map((r) => r.name)).toEqual(["Carol", "Bob", "Alice"]);
    });
});
