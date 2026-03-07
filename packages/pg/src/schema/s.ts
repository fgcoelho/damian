import type { DbSchema } from "..";
import type { StandardSchemaV1 } from "../lib/standard-schema";
import { formatTypeError, makeSchema } from "./utils";

export function string(sqlType = "text"): DbSchema<string> {
  return makeSchema(sqlType, (value): StandardSchemaV1.Result<string> => {
    if (typeof value === "string") return { value };
    return { issues: [{ message: formatTypeError("string", typeof value) }] };
  });
}

export function number(sqlType = "integer"): DbSchema<number> {
  return makeSchema(sqlType, (value): StandardSchemaV1.Result<number> => {
    if (typeof value === "number") return { value };
    return { issues: [{ message: formatTypeError("number", typeof value) }] };
  });
}

export function boolean(sqlType = "boolean"): DbSchema<boolean> {
  return makeSchema(sqlType, (value): StandardSchemaV1.Result<boolean> => {
    if (typeof value === "boolean") return { value };
    return { issues: [{ message: formatTypeError("boolean", typeof value) }] };
  });
}

export function optional<T>(schema: DbSchema<T>): DbSchema<T | undefined> {
  return makeSchema(schema.sqlType, (value) => {
    if (value === undefined || value === null)
      return { value: undefined as T | undefined };
    return schema["~standard"].validate(value) as StandardSchemaV1.Result<
      T | undefined
    >;
  });
}

export function nullable<T>(schema: DbSchema<T>): DbSchema<T | null> {
  return makeSchema(schema.sqlType, (value) => {
    if (value === null || value === undefined)
      return { value: null as T | null };
    return schema["~standard"].validate(
      value,
    ) as StandardSchemaV1.Result<T | null>;
  });
}

export function array<T>(
  elementSchema: DbSchema<T>,
  sqlType?: string,
): DbSchema<T[]> {
  return makeSchema(
    sqlType ?? `${elementSchema.sqlType}[]`,
    (value): StandardSchemaV1.Result<T[]> => {
      if (Array.isArray(value)) return { value: value as T[] };
      return { issues: [{ message: formatTypeError("array", typeof value) }] };
    },
  );
}

export function unknown(sqlType = "jsonb"): DbSchema<any> {
  return makeSchema(
    sqlType,
    (value): StandardSchemaV1.Result<any> => ({ value }),
  );
}

export function object<T extends Record<string, unknown>>(
  _shape: { [K in keyof T]: StandardSchemaV1<T[K]> },
  sqlType = "jsonb",
): DbSchema<T> {
  return makeSchema(sqlType, (value): StandardSchemaV1.Result<T> => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return { value: value as T };
    }
    return { issues: [{ message: formatTypeError("object", typeof value) }] };
  });
}

function u(): DbSchema<void> {
  return makeSchema("undefined", (value): StandardSchemaV1.Result<void> => {
    if (value === undefined) return { value: undefined };
    return {
      issues: [{ message: formatTypeError("undefined", typeof value) }],
    };
  });
}

export { u as undefined };

export function fromStandard<T>(
  externalValidator: StandardSchemaV1<T>,
  sqlType: string,
): DbSchema<T> {
  return {
    sqlType,
    "~standard": externalValidator["~standard"],
  };
}
