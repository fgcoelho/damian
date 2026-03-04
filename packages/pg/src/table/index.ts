import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { TypeNameIdentifier, ValueExpression } from "slonik";
import { identifier as sqlIdentifier } from "../sql/identifier.js";
import {
  type AnyType,
  type Prettify,
  SLONIK_FRAGMENT,
  type SQLFragment,
  type SQLIdentifier,
} from "../utils.js";
import { serializeValue } from "./serialization.js";

export type Column<S extends StandardSchemaV1> = SQLIdentifier &
  StandardSchemaV1<
    StandardSchemaV1.InferInput<S>,
    StandardSchemaV1.InferOutput<S>
  >;

type InferRowType<S extends Record<string, StandardSchemaV1>> = Prettify<{
  [K in keyof S]: StandardSchemaV1.InferOutput<S[K]>;
}>;

export type TableSchema<S extends Record<string, StandardSchemaV1>> =
  StandardSchemaV1<InferRowType<S>> & { cols: S };

export type RowsResult = {
  cols: SQLIdentifier[];
  rows: ValueExpression[][];
  types: TypeNameIdentifier[];
};

export type RowResult = {
  cols: SQLIdentifier[];
  row: ValueExpression[];
  types: TypeNameIdentifier[];
};

export type TableShape = {
  tableName: string;
  tableSchema: string;
  cols: SQLIdentifier[];
  schema: StandardSchemaV1;
};

export type Table<S extends Record<string, StandardSchemaV1>> = {
  [K in keyof S]: Column<S[K]>;
} & {
  tableName: string;
  tableSchema: string;
  schema: TableSchema<S>;
  cols: Column<S[keyof S]>[];
  types: TypeNameIdentifier[];

  rows(values: StandardSchemaV1.InferInput<Table<S>>[]): RowsResult;
  partialRows(
    values: Partial<StandardSchemaV1.InferInput<Table<S>>>[],
  ): RowsResult;
  row(values: StandardSchemaV1.InferInput<Table<S>>): RowResult;
  partialRow(values: Partial<StandardSchemaV1.InferInput<Table<S>>>): RowResult;

  createRows(values: StandardSchemaV1.InferInput<Table<S>>[]): RowsResult;
  createPartialRows(
    values: Partial<StandardSchemaV1.InferInput<Table<S>>>[],
  ): RowsResult;
  createRow(values: StandardSchemaV1.InferInput<Table<S>>): RowResult;
  createPartialRow(
    values: Partial<StandardSchemaV1.InferInput<Table<S>>>,
  ): RowResult;

  sql: string;
  values: ValueExpression[];
  type: typeof SLONIK_FRAGMENT;
  "~standard": StandardSchemaV1<InferRowType<S>>["~standard"];
} & SQLFragment;

export function table<S extends Record<string, StandardSchemaV1>>(
  tableSchema: string,
  tableName: string,
  shape: S,
): Table<S> {
  const colNames = Object.keys(shape);
  const rowSchema = buildTableSchema(shape);
  const typeMap = buildTypeMap(shape, colNames);
  const types = colNames.map((col) => typeMap[col]);

  const qualifiedColumns = buildQualifiedColumnAccessors(
    shape,
    colNames,
    tableName,
  );
  const unqualifiedColumns = buildUnqualifiedColumns(shape, colNames);

  const tableObj = {
    ...qualifiedColumns,
    tableName,
    tableSchema,
    schema: rowSchema,
    cols: unqualifiedColumns,
    types: [...types],

    rows: (values: AnyType[]) => buildRows(values, colNames, shape),
    partialRows: (values: AnyType[]) => buildRows(values, colNames, shape),
    row: (values: AnyType) => buildRow(values, colNames, shape),
    partialRow: (values: AnyType) => buildRow(values, colNames, shape),

    createRows: (values: AnyType[]) => buildRows(values, colNames, shape),
    createPartialRows: (values: AnyType[]) =>
      buildRows(values, colNames, shape),
    createRow: (values: AnyType) => buildRow(values, colNames, shape),
    createPartialRow: (values: AnyType) => buildRow(values, colNames, shape),

    sql: `"${tableSchema}"."${tableName}"`,
    values: [],
    type: SLONIK_FRAGMENT as AnyType,
    "~standard": rowSchema["~standard"],
  };

  return tableObj as unknown as Table<S>;
}

function buildTableSchema<S extends Record<string, StandardSchemaV1>>(
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

function buildTypeMap<S extends Record<string, StandardSchemaV1>>(
  shape: S,
  colNames: string[],
): Record<string, string> {
  return Object.fromEntries(
    colNames.map((col) => [col, (shape[col] as AnyType).sqlType ?? "text"]),
  );
}

function buildQualifiedColumnAccessors<
  S extends Record<string, StandardSchemaV1>,
>(
  shape: S,
  colNames: string[],
  tableName: string,
): Record<string, Column<AnyType>> {
  return Object.fromEntries(
    colNames.map((key) => {
      const col: Column<AnyType> = {
        ...sqlIdentifier([tableName, key]),
        "~standard": shape[key]["~standard"],
      };
      return [key, col];
    }),
  );
}

function buildUnqualifiedColumns<S extends Record<string, StandardSchemaV1>>(
  shape: S,
  colNames: string[],
): Column<AnyType>[] {
  return colNames.map((col) => ({
    ...sqlIdentifier([col]),
    "~standard": shape[col]["~standard"],
  }));
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

function buildRows<S extends Record<string, StandardSchemaV1>>(
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
    cols: includedColumns.map((col) => sqlIdentifier([col])),
    rows: values.map((record) => recordToValues(record, includedColumns)),
    types,
  };
}

function buildRow<S extends Record<string, StandardSchemaV1>>(
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
    cols: includedColumns.map((col) => sqlIdentifier([col])),
    row: recordToValues(values, includedColumns),
    types,
  };
}
