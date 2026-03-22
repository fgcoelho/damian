import Case from "case";
import type { DatabaseTable } from "../helpers/schema-model";
import type { ParsedTable } from "../helpers/schema-parser";

type TableLike = Pick<ParsedTable, "schema" | "table"> & {
  columns: Array<Pick<ParsedTable["columns"][number], "name">>;
};

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateTypingsOutput(
  tables: TableLike[],
  output: "damian" | "drizzle" = "damian",
): string {
  const tablesBySchema = groupTablesBySchema(tables);

  const schemaBlocks = [...tablesBySchema.entries()].map(
    ([schema, schemaTables]) => {
      const tableBlocks = schemaTables.map(
        (t) =>
          `    ${t.table}: {\n${t.columns.map((col) => `      ${col.name}: any;`).join("\n")}\n    };`,
      );
      return `  ${schema}: {\n${tableBlocks.join("\n")}\n  };`;
    },
  );

  if (output === "damian") {
    return [
      "// This file is auto-generated from the database schema. Do not edit directly.",
      "import type { CreateTypings } from '@damiandb/pg';",
      "",
      `export type Typings = CreateTypings<{\n${schemaBlocks.join("\n")}\n}>;`,
    ].join("\n");
  }

  return [
    "// This file is auto-generated from the database schema. Do not edit directly.",
    "type CreateTypings<TShape extends Record<string, Record<string, Record<string, unknown>>>> = Partial<{",
    "  [TSchema in keyof TShape]?: {",
    "    [TTable in keyof TShape[TSchema]]?: {",
    "      [TColumn in keyof TShape[TSchema][TTable]]?: unknown;",
    "    };",
    "  };",
    "}>;",
    "",
    `export type Typings = CreateTypings<{\n${schemaBlocks.join("\n")}\n}>;`,
  ].join("\n");
}

export function generateTablesOutput(
  tables: ParsedTable[],
  customTypings: Record<string, string>,
): string {
  const hasCustomTypings = Object.keys(customTypings).length > 0;
  const schemas = [...new Set(tables.map((t) => t.schema.toUpperCase()))];

  const schemaEnum = buildSchemaEnum(schemas);
  const tableBlocks = tables.map((t) => buildTableBlock(t, customTypings));

  const lines = [
    "// This file is auto-generated from the database schema. Do not edit directly.",
    `import { s, table } from '@damiandb/pg';`,
  ];
  if (hasCustomTypings) lines.push(`import typings from '../typings';`);
  lines.push("", schemaEnum, "", ...tableBlocks, "");

  return lines.join("\n");
}

function groupTablesBySchema(tables: TableLike[]): Map<string, TableLike[]> {
  const bySchema = new Map<string, TableLike[]>();
  for (const t of tables) {
    if (!bySchema.has(t.schema)) bySchema.set(t.schema, []);
    // biome-ignore lint/style/noNonNullAssertion: guaranteed by the if check above
    bySchema.get(t.schema)!.push(t);
  }
  return bySchema;
}

export function toTableLike(tables: DatabaseTable[]): TableLike[] {
  return tables.map((table) => ({
    schema: table.schema,
    table: table.table,
    columns: table.columns.map((column) => ({ name: column.name })),
  }));
}

function buildSchemaEnum(schemas: string[]): string {
  const entries = schemas
    .map((s) => `    ${s} = "${s.toLowerCase()}"`)
    .join(",\n");
  return `enum Schema {\n${entries}\n}`;
}

function buildTableBlock(
  t: ParsedTable,
  customTypings: Record<string, string>,
): string {
  const tableCamel = Case.camel(t.table);

  const cols = t.columns.map((col) => {
    const key = `${t.schema}.${t.table}.${col.name}`;
    if (customTypings[key]) {
      return `    ${col.name}: s.fromStandard(typings.${t.schema}.${t.table}.${col.name}, "${col.sqlType}"),`;
    }
    return `    ${col.name}: ${col.schemaType},`;
  });

  return `export const ${capitalize(tableCamel)}Table = table(Schema.${t.schema.toUpperCase()}, "${t.table}", {\n${cols.join("\n")}\n});`;
}
