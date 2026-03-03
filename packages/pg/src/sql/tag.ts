import type { StandardSchemaV1 } from "@standard-schema/spec";
import { createSqlTag, type QuerySqlToken, type ValueExpression } from "slonik";
import { DbError } from "../errors.js";
import type { Table, TableShape } from "../table/index.js";
import type { AnyType, Prettify } from "../utils.js";
import {
  createSchemaParser,
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

type CustomSQLTag = SqlTagPlugins & {
  [K in keyof typeof sqlTag]: (typeof sqlTag)[K];
};

export type SQL = {
  (
    template: TemplateStringsArray,
    ...values: ValueExpression[]
  ): QuerySqlToken<AnyType>;
  <S extends Record<string, StandardSchemaV1>>(
    table: Table<S>,
  ): TaggedTemplateFn<StandardSchemaV1<InferRowType<S>>>;
  <S extends StandardSchemaV1>(schema: S): TaggedTemplateFn<S>;
} & CustomSQLTag;

function castToken<T extends StandardSchemaV1>(
  token: AnyType,
): QuerySqlToken<T> {
  return token as QuerySqlToken<T>;
}

function buildTypedTag<S extends StandardSchemaV1>(schema: S) {
  return (template: TemplateStringsArray, ...vals: ValueExpression[]) =>
    castToken(
      sqlTag.type(createSchemaParser(schema) as AnyType)(template, ...vals),
    );
}

function mainSql(
  templateOrTableOrSchema: TemplateStringsArray | TableShape | StandardSchemaV1,
  ...values: ValueExpression[]
): AnyType {
  if (isTemplateArray(templateOrTableOrSchema)) {
    return castToken(
      sqlTag.fragment(
        templateOrTableOrSchema as TemplateStringsArray,
        ...values,
      ),
    );
  }

  if (isTable(templateOrTableOrSchema)) {
    return buildTypedTag(templateOrTableOrSchema.schema);
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
