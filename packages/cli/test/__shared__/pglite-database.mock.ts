import type { DatabasePool } from "@damiandb/pg";
import { createDb } from "@damiandb/pg";
import { PGlite } from "@electric-sql/pglite";
import { createPGLiteDriverFactory } from "slonik-pglite-driver";

type PGliteParam = Parameters<typeof createPGLiteDriverFactory>[0];

export async function createTestPool(): Promise<DatabasePool> {
  const pg = new PGlite();
  const driverFactory = createPGLiteDriverFactory(pg as unknown as PGliteParam);
  return createDb({ connectionString: "postgres://", driverFactory });
}
