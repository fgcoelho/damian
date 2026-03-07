import type { TypeNameIdentifier, ValueExpression } from "slonik";
import type { StandardSchemaV1 } from "../lib/standard-schema";
import type {
  Prettify,
  SLONIK_FRAGMENT,
  SQLFragment,
  SQLIdentifier,
} from "../lib/utils";

export type InferRowType<S extends Record<string, StandardSchemaV1>> =
  Prettify<{
    [K in keyof S]: StandardSchemaV1.InferOutput<S[K]>;
  }>;

export type Column<S extends StandardSchemaV1> = SQLIdentifier &
  StandardSchemaV1<
    StandardSchemaV1.InferInput<S>,
    StandardSchemaV1.InferOutput<S>
  >;

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
