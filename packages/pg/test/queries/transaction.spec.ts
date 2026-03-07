import { afterAll, beforeAll, describe, expect } from "vitest";
import { s } from "../../src/index";
import { createTestPool } from "../__shared__/database";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

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

describe("transaction", () => {
  it()
    .should("roll back inserts when the callback throws")
    .test(async () => {
      await db
        .transaction(async (tx) => {
          await expect(
            tx.transaction(async (nested) => {
              await nested.query(
                sql.void`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`,
              );
              throw new Error("intentional rollback");
            }),
          ).rejects.toThrow("intentional rollback");

          const { rows } = await tx.query(
            sql(CountSchema)`SELECT COUNT(*)::int AS n FROM users`,
          );
          expect(rows[0].n).toBe(0);

          throw new Error("rollback outer");
        })
        .catch((e: unknown) => {
          if (e instanceof Error && e.message !== "rollback outer") throw e;
        });
    });

  it()
    .should("commit all inserts when the callback completes successfully")
    .test(async () => {
      await db
        .transaction(async (tx) => {
          await tx.transaction(async (nested) => {
            await nested.query(
              sql.void`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', 'bob@example.com')`,
            );
          });

          const { rows } = await tx.query(
            sql(CountSchema)`SELECT COUNT(*)::int AS n FROM users`,
          );
          expect(rows[0].n).toBe(2);

          throw new Error("rollback outer");
        })
        .catch((e: unknown) => {
          if (e instanceof Error && e.message !== "rollback outer") throw e;
        });
    });
});
