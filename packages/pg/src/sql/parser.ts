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

export function isSchemaRecord(
  value: unknown,
): value is Record<string, StandardSchemaV1> {
  if (typeof value !== "object" || value === null) return false;
  if (isTable(value) || isStandardSchema(value)) return false;
  return Object.values(value as object).every(isStandardSchema);
}

export function buildSchemaRecordParser<
  S extends Record<string, StandardSchemaV1>,
>(_record: S) {
  return (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Expected object row");
    }
    return value as { [K in keyof S]: StandardSchemaV1.InferOutput<S[K]> };
  };
}

export function createSchemaParser<S extends StandardSchemaV1>(schema: S) {
  return (value: unknown) =>
    assertParseResult(schema["~standard"].validate(value));
}
