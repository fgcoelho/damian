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
});

afterAll(async () => {
  await db.end();
});

describe("UPDATE SET", () => {
  it()
    .should("update a record using a plain column identifier")
    .test(async () => {
      await db.query(
        sql.void`INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com')`,
      );
      await db.query(
        sql.void`UPDATE ${UserTable} SET name = ${"Alice Renamed"} WHERE ${UserTable.id} = ${1}`,
      );
      const result = await db.query(
        sql(UserTable)`SELECT * FROM ${UserTable} WHERE ${UserTable.id} = ${1}`,
      );
      expect(result.rows[0].name).toBe("Alice Renamed");
    });

  it()
    .should("update a single column using sql.target to strip the qualifier")
    .test(async () => {
      await db.query(
        sql.void`INSERT INTO users (id, name, email) VALUES (2, 'Bob', 'bob@example.com')`,
      );
      await db.query(
        sql.void`UPDATE ${UserTable} SET ${sql.target(UserTable.name)} = ${"Bob Updated"} WHERE ${UserTable.id} = ${2}`,
      );
      const result = await db.query(
        sql(UserTable)`SELECT * FROM ${UserTable} WHERE ${UserTable.id} = ${2}`,
      );
      expect(result.rows[0].name).toBe("Bob Updated");
    });

  it()
    .should("update multiple columns using sql.targets + ROW()")
    .test(async () => {
      await db.query(
        sql.void`INSERT INTO users (id, name, email) VALUES (3, 'Carol', 'carol@example.com')`,
      );
      const { cols, row } = UserTable.createRow({
        id: 3,
        name: "Carol Updated",
        email: "carol@updated.com",
      });
      await db.query(
        sql.void`UPDATE ${UserTable} SET ${sql.tuple(sql.targets(cols))} = ROW(${sql.join.comma(row)}) WHERE ${UserTable.id} = ${3}`,
      );
      const result = await db.query(
        sql(UserTable)`SELECT * FROM ${UserTable} WHERE ${UserTable.id} = ${3}`,
      );
      expect(result.rows[0].name).toBe("Carol Updated");
      expect(result.rows[0].email).toBe("carol@updated.com");
    });
});
