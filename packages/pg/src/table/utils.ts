import { createSqlTag, type ValueExpression } from "slonik";
import type { StandardSchemaV1 } from "../lib/standard-schema";
import type { AnyType } from "../lib/utils";
import { serializeValue } from "./serialization";
import type {
  Column,
  InferRowType,
  RowResult,
  RowsResult,
  TableSchema,
} from "./types";

const sql = createSqlTag();

function recordToValues(
  record: AnyType,
  includedColumns: string[],
): ValueExpression[] {
  return includedColumns.map((col) => serializeValue((record as AnyType)[col]));
}

function prepareColumnsAndTypes<S extends Record<string, StandardSchemaV1>>(
  values: AnyType[],
  colNames: string[],
  shape: S,
): { includedColumns: string[]; types: string[] } {
  const includedColumns = collectIncludedColumns(values, colNames);
  const typeMap = buildTypeMap(shape, colNames);
  const types = includedColumns.map((col) => typeMap[col]);
  return { includedColumns, types };
}

function collectIncludedColumns(
  values: AnyType[],
  colNames: string[],
): string[] {
  const included = new Set<string>();
  for (const record of values) {
    for (const col of colNames) {
      if ((record as AnyType)[col] !== undefined) {
        included.add(col);
      }
    }
  }
  return Array.from(included);
}

export function buildTypeMap<S extends Record<string, StandardSchemaV1>>(
  shape: S,
  colNames: string[],
): Record<string, string> {
  return Object.fromEntries(
    colNames.map((col) => [col, (shape[col] as AnyType).sqlType ?? "text"]),
  );
}

export function buildTableSchema<S extends Record<string, StandardSchemaV1>>(
  shape: S,
): TableSchema<S> {
  const rowStandardSchema: StandardSchemaV1<InferRowType<S>> = {
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        if (typeof value !== "object" || value === null) {
          return { issues: [{ message: "Expected object" }] };
        }
        return { value: value as InferRowType<S> };
      },
    },
  };

  return Object.assign(rowStandardSchema, { cols: shape }) as TableSchema<S>;
}

export function buildQualifiedColumnAccessors<
  S extends Record<string, StandardSchemaV1>,
>(
  shape: S,
  colNames: string[],
  tableName: string,
): Record<string, Column<AnyType>> {
  return Object.fromEntries(
    colNames.map((key) => {
      const col: Column<AnyType> = {
        ...sql.identifier([tableName, key]),
        "~standard": shape[key]["~standard"],
      };
      return [key, col];
    }),
  );
}

export function buildUnqualifiedColumns<
  S extends Record<string, StandardSchemaV1>,
>(shape: S, colNames: string[]): Column<AnyType>[] {
  return colNames.map((col) => ({
    ...sql.identifier([col]),
    "~standard": shape[col]["~standard"],
  }));
}

export function buildRows<S extends Record<string, StandardSchemaV1>>(
  values: AnyType[],
  colNames: string[],
  shape: S,
): RowsResult {
  const { includedColumns, types } = prepareColumnsAndTypes(
    values,
    colNames,
    shape,
  );
  return {
    cols: includedColumns.map((col) => sql.identifier([col])),
    rows: values.map((record) => recordToValues(record, includedColumns)),
    types,
  };
}

export function buildRow<S extends Record<string, StandardSchemaV1>>(
  values: AnyType,
  colNames: string[],
  shape: S,
): RowResult {
  const { includedColumns, types } = prepareColumnsAndTypes(
    [values],
    colNames,
    shape,
  );

  return {
    cols: includedColumns.map((col) => sql.identifier([col])),
    row: recordToValues(values, includedColumns),
    types,
  };
}
