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

const PostTable = table("public", "posts", {
  id: s.number("int4"),
  user_id: s.number("int4"),
  title: s.string("text"),
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
  await db.query(sql.void`
    CREATE TABLE posts (
      id      serial PRIMARY KEY,
      user_id int NOT NULL,
      title   text NOT NULL
    )
  `);
});

afterAll(async () => {
  await db.end();
});

describe("RETURNING", () => {
  it()
    .should("return the inserted row via INSERT ... RETURNING *")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`INSERT INTO users (name, email) VALUES ('Alice', 'alice1@example.com') RETURNING *`,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Alice");
      expect(result.rows[0].id).toBeTypeOf("number");
    });

  it()
    .should("return the updated row via UPDATE ... RETURNING *")
    .test(async () => {
      await db.query(
        sql.void`INSERT INTO users (name, email) VALUES ('Bob', 'bob1@example.com')`,
      );
      const result = await db.query(
        sql(
          UserTable,
        )`UPDATE ${UserTable} SET name = ${"Bob Renamed"} WHERE ${UserTable.email} = ${"bob1@example.com"} RETURNING *`,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Bob Renamed");
    });

  it()
    .should("return the deleted row via DELETE ... RETURNING *")
    .test(async () => {
      await db.query(
        sql.void`INSERT INTO posts (user_id, title) VALUES (1, 'Old Post')`,
      );
      const result = await db.query(
        sql(
          PostTable,
        )`DELETE FROM ${PostTable} WHERE ${PostTable.title} = ${"Old Post"} RETURNING *`,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe("Old Post");
    });
});
