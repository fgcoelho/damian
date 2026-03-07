import type { StandardSchemaV1 } from "../lib/standard-schema";
import { type AnyType, SLONIK_FRAGMENT } from "../lib/utils";
import type { Table } from "./types";
import {
  buildQualifiedColumnAccessors,
  buildRow,
  buildRows,
  buildTableSchema,
  buildTypeMap,
  buildUnqualifiedColumns,
} from "./utils";

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
