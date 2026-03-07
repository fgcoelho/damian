import { DbError } from "../lib/errors";
import type { StandardSchemaV1 } from "../lib/standard-schema";

export type DbSchema<T> = StandardSchemaV1<T> & {
  sqlType: string;
};

export function formatTypeError(expected: string, actual: string): string {
  return `Expected ${expected}, got ${actual}`;
}

export function makeSchema<T>(
  sqlType: string,
  validate: (value: unknown) => StandardSchemaV1.Result<T>,
): DbSchema<T> {
  return {
    sqlType,
    "~standard": { version: 1, vendor: "damiandb", validate },
  };
}

export function assertParseResult<T>(
  result: StandardSchemaV1.Result<T> | Promise<StandardSchemaV1.Result<T>>,
): T {
  if (result instanceof Promise) {
    throw new DbError(
      "ASYNC_VALIDATION_UNSUPPORTED",
      "Async validation is not supported in sql tag",
    );
  }
  if (result.issues) {
    throw new DbError("VALIDATION_FAILED", JSON.stringify(result.issues));
  }
  return result.value;
}
