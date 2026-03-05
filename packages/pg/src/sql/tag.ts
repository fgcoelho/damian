import {
  createSqlTag,
  type PrimitiveValueExpression,
  type QuerySqlToken,
  type ValueExpression,
} from "slonik";
import { DbError } from "../errors.js";
import type { StandardSchemaV1 } from "../schema/standard-schema.js";
import type { Table, TableShape } from "../table/index.js";
import type { AnyType, Prettify, SQLFragment, SQLQuery } from "../utils.js";
import {
  buildSchemaRecordParser,
  createSchemaParser,
  isSchemaRecord,
  isStandardSchema,
  isTable,
  isTemplateArray,
} from "./parser.js";
import { type SqlTagPlugins, sqlTagPlugins } from "./plugins.js";

const sqlTag = createSqlTag({ typeAliases: { void: (() => {}) as AnyType } });

type InferRowType<S extends Record<string, StandardSchemaV1>> = Prettify<{
  [K in keyof S]: StandardSchemaV1.InferOutput<S[K]>;
}>;

export type TaggedTemplateFn<T extends StandardSchemaV1> = (
  template: TemplateStringsArray,
  ...values: ValueExpression[]
) => QuerySqlToken<T>;

export type SqlTemplateToken = {
  readonly parser: AnyType;
  readonly sql: string;
  readonly type: SQLQuery["type"] & SQLFragment["type"];
  readonly values: readonly PrimitiveValueExpression[];
};

type CustomSQLTag = SqlTagPlugins & {
  [K in keyof typeof sqlTag]: (typeof sqlTag)[K];
};

export type SQL = {
  (
    template: TemplateStringsArray,
    ...values: ValueExpression[]
  ): SqlTemplateToken;
  <S extends Record<string, StandardSchemaV1>>(
    table: Table<S>,
  ): TaggedTemplateFn<StandardSchemaV1<InferRowType<S>>>;
  <S extends Record<string, StandardSchemaV1>>(
    schemas: S,
  ): TaggedTemplateFn<StandardSchemaV1<InferRowType<S>>>;
  <S extends StandardSchemaV1>(schema: S): TaggedTemplateFn<S>;
} & CustomSQLTag;

function castToken<T extends StandardSchemaV1>(
  token: AnyType,
): QuerySqlToken<T> {
  return token as QuerySqlToken<T>;
}

function castTemplateToken(token: AnyType): SqlTemplateToken {
  return token as SqlTemplateToken;
}

function buildTypedTag<S extends StandardSchemaV1>(schema: S) {
  return (template: TemplateStringsArray, ...vals: ValueExpression[]) =>
    castToken(
      sqlTag.type(createSchemaParser(schema) as AnyType)(template, ...vals),
    );
}

function buildRecordTag<S extends Record<string, StandardSchemaV1>>(record: S) {
  return (template: TemplateStringsArray, ...vals: ValueExpression[]) =>
    castToken<StandardSchemaV1<InferRowType<S>>>(
      sqlTag.type(buildSchemaRecordParser(record) as AnyType)(
        template,
        ...vals,
      ),
    );
}

function mainSql(
  templateOrTableOrSchema:
    | TemplateStringsArray
    | TableShape
    | StandardSchemaV1
    | Record<string, StandardSchemaV1>,
  ...values: ValueExpression[]
): AnyType {
  if (isTemplateArray(templateOrTableOrSchema)) {
    return castTemplateToken(
      sqlTag.fragment(
        templateOrTableOrSchema as TemplateStringsArray,
        ...values,
      ),
    );
  }

  if (isTable(templateOrTableOrSchema)) {
    return buildTypedTag(templateOrTableOrSchema.schema);
  }

  if (isSchemaRecord(templateOrTableOrSchema)) {
    return buildRecordTag(
      templateOrTableOrSchema as Record<string, StandardSchemaV1>,
    );
  }

  if (isStandardSchema(templateOrTableOrSchema)) {
    return buildTypedTag(templateOrTableOrSchema as StandardSchemaV1);
  }

  throw new DbError("INVALID_SQL_TAG", "Invalid arguments passed to sql()");
}

export function createSQL(): SQL {
  return Object.assign(mainSql, sqlTag, sqlTagPlugins) as SQL;
}

export const sql: SQL = createSQL();
