import { PGlite } from "@electric-sql/pglite";
import { createPGLiteDriverFactory } from "slonik-pglite-driver";
import type { CreateDbOptions, DatabasePool } from "../../src/db.js";
import { createDb } from "../../src/db.js";

type PGliteParam = Parameters<typeof createPGLiteDriverFactory>[0];

export async function createTestPool(
  options: Partial<CreateDbOptions> = {},
): Promise<DatabasePool> {
  const pg = new PGlite();
  const driverFactory = createPGLiteDriverFactory(pg as unknown as PGliteParam);
  return createDb({
    connectionString: "postgres://",
    driverFactory,
    ...options,
  });
}
