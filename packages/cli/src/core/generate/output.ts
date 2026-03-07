import Case from "case";
import type { ParsedTable } from "./schema-parser";

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateTypingsOutput(tables: ParsedTable[]): string {
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

  return [
    "// This file is auto-generated from the database schema. Do not edit directly.",
    "import type { CreateTypings } from '@damiandb/pg';",
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

function groupTablesBySchema(
  tables: ParsedTable[],
): Map<string, ParsedTable[]> {
  const bySchema = new Map<string, ParsedTable[]>();
  for (const t of tables) {
    if (!bySchema.has(t.schema)) bySchema.set(t.schema, []);
    // biome-ignore lint/style/noNonNullAssertion: guaranteed by the if check above
    bySchema.get(t.schema)!.push(t);
  }
  return bySchema;
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
