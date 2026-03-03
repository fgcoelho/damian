import type { StandardSchemaV1 } from "@standard-schema/spec";
import { assertParseResult } from "../schema/index.js";
import type { TableShape } from "../table/index.js";

export function isTemplateArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && "raw" in (value as object);
}

export function isTable(value: unknown): value is TableShape {
  return typeof value === "object" && value !== null && "tableName" in value;
}

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return typeof value === "object" && value !== null && "~standard" in value;
}

export function createSchemaParser<S extends StandardSchemaV1>(schema: S) {
  return (value: unknown) =>
    assertParseResult(schema["~standard"].validate(value));
}
