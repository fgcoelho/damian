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
      ('Alice', 'a@x.com'),
      ('Bob',   'b@x.com'),
      ('Carol', 'c@x.com')`,
  );
});

afterAll(async () => {
  await db.end();
});

describe("LIMIT and OFFSET", () => {
  it()
    .should("return at most N rows")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} ORDER BY ${UserTable.name} ASC LIMIT ${2}`,
      );
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe("Alice");
      expect(result.rows[1].name).toBe("Bob");
    });

  it()
    .should("skip N rows and return the remainder")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} ORDER BY ${UserTable.name} ASC LIMIT ${10} OFFSET ${1}`,
      );
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe("Bob");
      expect(result.rows[1].name).toBe("Carol");
    });

  it()
    .should("return an empty result when offset exceeds row count")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} ORDER BY ${UserTable.name} ASC LIMIT ${10} OFFSET ${5}`,
      );
      expect(result.rows).toHaveLength(0);
    });
});
