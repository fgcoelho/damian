import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import { createSQL } from "../src/sql.js";
import { table } from "../src/table.js";
import { createTestPool } from "./__shared__/pglite-database.js";

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

const sql = createSQL();

describe("SELECT — table in FROM + WHERE on column identifier", () => {
  it("returns rows matching a WHERE clause on a column identifier", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);
      await tx.query(
        sql.void`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', 'bob@example.com')`,
      );

      const result = await tx.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} WHERE ${UserTable.name} = ${"Alice"}`,
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Alice");
    });

    await db.end();
  });

  it("returns all rows when WHERE matches multiple records", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);
      await tx.query(
        sql.void`INSERT INTO users (name, email) VALUES ('Alice', 'a@x.com'), ('Bob', 'b@x.com')`,
      );

      const result = await tx.query(sql(UserTable)`SELECT * FROM ${UserTable}`);

      expect(result.rows).toHaveLength(2);
    });

    await db.end();
  });
});

describe("INSERT — table.createRows + sql.tuple/tuples", () => {
  it("inserts a single row using createRow + sql.tuple", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);

      const { cols, row } = UserTable.createRow({
        id: 1,
        name: "Alice",
        email: "alice@example.com",
      });

      await tx.query(
        sql.void`INSERT INTO users ${sql.tuple(cols)} VALUES ${sql.tuple(row)}`,
      );

      const result = await tx.query(
        sql(UserTable)`SELECT * FROM users WHERE name = ${"Alice"}`,
      );

      expect(result.rows[0].name).toBe("Alice");
    });

    await db.end();
  });

  it("inserts multiple rows using createRows + sql.tuples", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);

      const records = [
        { id: 1, name: "Alice", email: "alice@example.com" },
        { id: 2, name: "Bob", email: "bob@example.com" },
        { id: 3, name: "Carol", email: "carol@example.com" },
      ];

      const { cols, rows } = UserTable.createRows(records);

      await tx.query(
        sql.void`INSERT INTO users ${sql.tuple(cols)} VALUES ${sql.tuples(rows)}`,
      );

      const countSchema = s.object({ n: s.number("int4") });
      const { rows: countRows } = await tx.query(
        sql(countSchema)`SELECT COUNT(*)::int AS n FROM users`,
      );

      expect(countRows[0].n).toBe(3);
    });

    await db.end();
  });
});

describe("Upsert — sql.excluded in ON CONFLICT DO UPDATE", () => {
  it("updates existing row on conflict using sql.excluded", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);

      await tx.query(
        sql.void`INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com')`,
      );

      const { cols, rows } = UserTable.createRows([
        { id: 1, name: "Alice Updated", email: "alice@example.com" },
      ]);

      const ignored = [UserTable.id];

      await tx.query(
        sql.void`
          INSERT INTO users ${sql.tuple(cols)}
          VALUES ${sql.tuples(rows)}
          ON CONFLICT (email) DO UPDATE
          SET ${sql.excluded(cols, ignored)}
        `,
      );

      const result = await tx.query(
        sql(
          UserTable,
        )`SELECT * FROM users WHERE email = ${"alice@example.com"}`,
      );

      expect(result.rows[0].name).toBe("Alice Updated");
    });

    await db.end();
  });
});

describe("UPDATE — real query", () => {
  it("updates a record and the change is reflected in a subsequent SELECT", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);

      await tx.query(
        sql.void`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`,
      );

      await tx.query(
        sql.void`UPDATE ${UserTable} SET name = ${"Alice Renamed"} WHERE ${UserTable.email} = ${"alice@example.com"}`,
      );

      const result = await tx.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} WHERE ${UserTable.email} = ${"alice@example.com"}`,
      );

      expect(result.rows[0].name).toBe("Alice Renamed");
    });

    await db.end();
  });
});

describe("DELETE — real query", () => {
  it("deletes a record and it is no longer returned by SELECT", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);

      await tx.query(
        sql.void`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', 'bob@example.com')`,
      );

      await tx.query(
        sql.void`DELETE FROM ${UserTable} WHERE ${UserTable.name} = ${"Alice"}`,
      );

      const result = await tx.query(sql(UserTable)`SELECT * FROM ${UserTable}`);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Bob");
    });

    await db.end();
  });

  it("DELETE ... RETURNING returns the deleted rows", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE posts (
          id    serial PRIMARY KEY,
          user_id int NOT NULL,
          title text NOT NULL
        )
      `);

      await tx.query(
        sql.void`INSERT INTO posts (user_id, title) VALUES (1, 'Old Post')`,
      );

      const result = await tx.query(
        sql(
          PostTable,
        )`DELETE FROM ${PostTable} WHERE ${PostTable.title} = ${"Old Post"} RETURNING *`,
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe("Old Post");
    });

    await db.end();
  });
});

describe("sql.inArray — real WHERE IN query", () => {
  it("returns only rows whose id is in the provided list", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);

      await tx.query(
        sql.void`INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'a@x.com'), (2, 'Bob', 'b@x.com'), (3, 'Carol', 'c@x.com')`,
      );

      const result = await tx.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} WHERE ${sql.inArray(UserTable.id, [1, 3])}`,
      );

      expect(result.rows).toHaveLength(2);
      const names = result.rows.map((r) => r.name).sort();
      expect(names).toEqual(["Alice", "Carol"]);
    });

    await db.end();
  });

  it("returns no rows when inArray is called with an empty list (FALSE)", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);

      await tx.query(
        sql.void`INSERT INTO users (name, email) VALUES ('Alice', 'a@x.com')`,
      );

      const result = await tx.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} WHERE ${sql.inArray(UserTable.id, [])}`,
      );

      expect(result.rows).toHaveLength(0);
    });

    await db.end();
  });
});

describe("sql.alias — real JOIN query", () => {
  it("joins two aliased instances of the same table", async () => {
    const PersonTable = table("public", "person", {
      id: s.number("int4"),
      name: s.string("text"),
      manager_id: s.nullable(s.number("int4")),
    });

    const employee = sql.alias(PersonTable, "employee");
    const manager = sql.alias(PersonTable, "manager");

    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE person (
          id         serial PRIMARY KEY,
          name       text NOT NULL,
          manager_id int REFERENCES person(id)
        )
      `);

      await tx.query(
        sql.void`INSERT INTO person (id, name, manager_id) VALUES (1, 'Boss', NULL), (2, 'Alice', 1)`,
      );

      const rowSchema = s.object({
        employee_name: s.string("text"),
        manager_name: s.string("text"),
      });

      const result = await tx.query(
        sql(rowSchema)`
          SELECT ${employee.name} AS employee_name, ${manager.name} AS manager_name
          FROM ${employee}
          INNER JOIN ${manager} ON ${employee.manager_id} = ${manager.id}
        `,
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].employee_name).toBe("Alice");
      expect(result.rows[0].manager_name).toBe("Boss");
    });

    await db.end();
  });
});

describe("sql.output().json() — real row_to_json query", () => {
  it("returns a json object for a single table row", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);

      await tx.query(
        sql.void`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`,
      );

      const rowSchema = s.object({
        users: s.object({
          id: s.number("int4"),
          name: s.string("text"),
          email: s.string("text"),
        }),
      });

      const result = await tx.query(
        sql(
          rowSchema,
        )`SELECT ${sql.output(UserTable).json()} FROM ${UserTable}`,
      );

      expect(result.rows[0].users.name).toBe("Alice");
    });

    await db.end();
  });

  it("returns an array of json objects with .json().array()", async () => {
    const db = await createTestPool();

    await db.transaction(async (tx) => {
      await tx.query(sql.void`
        CREATE TABLE users (
          id   serial PRIMARY KEY,
          name text NOT NULL,
          email text NOT NULL UNIQUE
        )
      `);

      await tx.query(sql.void`
        CREATE TABLE posts (
          id      serial PRIMARY KEY,
          user_id int NOT NULL REFERENCES users(id),
          title   text NOT NULL
        )
      `);

      await tx.query(
        sql.void`INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com')`,
      );

      await tx.query(
        sql.void`INSERT INTO posts (user_id, title) VALUES (1, 'Post A'), (1, 'Post B')`,
      );

      const rowSchema = s.object({
        users: s.object({
          id: s.number("int4"),
          name: s.string("text"),
          email: s.string("text"),
        }),
        posts: s.array(s.any("jsonb")),
      });

      const result = await tx.query(
        sql(rowSchema)`
          SELECT
            ${sql.output(UserTable).json()},
            ${sql.output(PostTable).json().array()}
          FROM ${UserTable}
          INNER JOIN ${PostTable} ON ${UserTable.id} = ${PostTable.user_id}
          GROUP BY ${UserTable.id}
        `,
      );

      expect(result.rows[0].users.name).toBe("Alice");
      expect(Array.isArray(result.rows[0].posts)).toBe(true);
      expect(result.rows[0].posts).toHaveLength(2);
    });

    await db.end();
  });
});

describe("sql.jsonArray — unit and live", () => {
  it("produces a fragment with JSON-encoded values in the parameter", () => {
    const frag = sql.jsonArray([{ id: 1 }, { id: 2 }]);
    expect(frag.values[0]).toContain('\\"id\\":1');
    expect(frag.values[0]).toContain('\\"id\\":2');
  });

  it("produces an empty parameter value for an empty input", () => {
    const frag = sql.jsonArray([]);
    expect(frag.values[0]).toBe("");
  });
});
