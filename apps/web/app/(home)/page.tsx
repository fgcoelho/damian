import { ArrowUpRightIcon } from "@heroicons/react/16/solid";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import Link from "next/link";
import { Icon } from "@/components/icon";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center">
      <article className="container max-w-4xl mx-auto px-4 py-8 prose prose-neutral dark:prose-invert prose-lg">
        <h1>🪨 damian</h1>

        <p className="lead">
          <strong>Migrate and query your database with ease.</strong>
        </p>

        <p>
          No schema DSL. No diff engine. No "push" shortcut. Write SQL
          migrations — Damian replays them to generate TypeScript types. One
          workflow, from local to production.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 not-prose my-8">
          <Link
            href="/docs/fundamentals/quickstart"
            className="inline-flex items-center px-6 py-3 bg-fd-primary text-fd-primary-foreground font-semibold rounded-lg hover:bg-fd-primary/90 transition-colors no-underline"
          >
            Get Started <ArrowUpRightIcon className="size-4 ml-2" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center px-6 py-3 border border-fd-border text-fd-foreground font-semibold rounded-lg hover:bg-fd-muted/50 transition-colors no-underline"
          >
            View Docs
          </Link>
        </div>

        <h2>Why Damian?</h2>

        <div className="grid md:grid-cols-3 gap-6 not-prose my-8">
          <div className="border border-fd-border rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-base inline-flex items-center">
              <Icon icon="CodeBracket" className="size-5 mr-2" />
              SQL is the source of truth
            </h3>
            <p className="text-fd-muted-foreground text-sm">
              Write migrations in SQL. Damian replays them in-memory and derives
              TypeScript types from the result. The schema lives in your
              migration files, not in a TypeScript DSL.
            </p>
          </div>
          <div className="border border-fd-border rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-base inline-flex items-center">
              <Icon icon="ShieldCheck" className="size-5 mr-2" />
              One workflow
            </h3>
            <p className="text-fd-muted-foreground text-sm">
              The command that runs migrations locally is the same command you
              run in production. No shadow database, no drift detection, no
              generated migrations to second-guess.
            </p>
          </div>
          <div className="border border-fd-border rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-base inline-flex items-center">
              <Icon icon="Wrench" className="size-5 mr-2" />
              Type-safe SQL
            </h3>
            <p className="text-fd-muted-foreground text-sm">
              Write real SQL with tagged template literals. Column references,
              parameter bindings, and row shapes are all checked at compile time
              against types that come directly from your schema.
            </p>
          </div>
        </div>

        <h2>Quick Example</h2>

        <Tabs
          groupId="operation"
          persist
          items={["SELECT", "INSERT", "UPDATE", "DELETE"]}
        >
          <Tab value="SELECT">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from './db'
import { UsersTable, PostsTable } from 'tables'

// Simple typed query
const { rows } = await db.query(
    sql(UsersTable)\`SELECT * FROM \${UsersTable} WHERE \${UsersTable.email} = \${"alice@example.com"}\`
)
const user = rows[0] // { id: number, name: string, email: string, ... }

// Relational query — join two tables, group results
const { rows: results } = await db.query(
    sql(UsersTable.schema)\`
        SELECT
            \${sql.output(UsersTable).json()},
            \${sql.output(PostsTable).json().array()}
        FROM \${UsersTable}
        INNER JOIN \${PostsTable} ON \${UsersTable.id} = \${PostsTable.user_id}
        GROUP BY \${UsersTable.id}
    \`
)

// WHERE IN — emits FALSE safely when array is empty
const { rows: filtered } = await db.query(
    sql(UsersTable)\`SELECT * FROM \${UsersTable} WHERE \${sql.inArray(UsersTable.id, [1, 2, 3])}\`
)`}
            />
          </Tab>
          <Tab value="INSERT">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from './db'
import { UsersTable } from 'tables'

// Single row
const { cols, row } = UsersTable.createRow({
    name: "Alice",
    email: "alice@example.com",
})

await db.query(
    sql.void\`INSERT INTO \${UsersTable} \${sql.tuple(cols)} VALUES \${sql.tuple(row)}\`
)

// Bulk insert
const records = [
    { name: "Alice", email: "alice@example.com" },
    { name: "Bob",   email: "bob@example.com" },
]

const { cols: bulkCols, rows } = UsersTable.createRows(records)

await db.query(
    sql.void\`INSERT INTO \${UsersTable} \${sql.tuple(bulkCols)} VALUES \${sql.tuples(rows)}\`
)

// Upsert
const { cols: uCols, rows: uRows } = UsersTable.createRows([{ name: "Alice", email: "alice@example.com" }])

await db.query(
    sql.void\`
        INSERT INTO \${UsersTable} \${sql.tuple(uCols)}
        VALUES \${sql.tuples(uRows)}
        ON CONFLICT (\${UsersTable.email}) DO UPDATE
        SET \${sql.excluded(uCols, [UsersTable.id])}
    \`
)`}
            />
          </Tab>
          <Tab value="UPDATE">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from './db'
import { UsersTable } from 'tables'

// Simple update
await db.query(
    sql.void\`UPDATE \${UsersTable} SET name = \${"Alice Renamed"} WHERE \${UsersTable.email} = \${"alice@example.com"}\`
)

// Dynamic WHERE using sql.identity
const nameFilter = shouldFilter
    ? sql.fragment\`\${UsersTable.name} = \${"Alice"}\`
    : sql.identity("and") // → TRUE, safe no-op in AND chains

await db.query(
    sql(UsersTable)\`SELECT * FROM \${UsersTable} WHERE \${nameFilter}\`
)`}
            />
          </Tab>
          <Tab value="DELETE">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from './db'
import { PostsTable } from 'tables'

// Fire-and-forget delete
await db.query(
    sql.void\`DELETE FROM \${PostsTable} WHERE \${PostsTable.id} = \${42}\`
)

// Delete with RETURNING — rows are fully typed
const { rows } = await db.query(
    sql(PostsTable)\`DELETE FROM \${PostsTable} WHERE \${PostsTable.title} = \${"Draft"} RETURNING *\`
)

// Wrapped in a transaction — throws → rolled back automatically
await db.transaction(async (tx) => {
    await tx.query(sql.void\`DELETE FROM \${PostsTable} WHERE \${PostsTable.user_id} = \${1}\`)
    await tx.query(sql.void\`DELETE FROM \${UsersTable} WHERE \${UsersTable.id} = \${1}\`)
})`}
            />
          </Tab>
        </Tabs>

        <h2>Installation</h2>

        <Tabs items={["npm", "pnpm", "yarn"]}>
          <Tab value="npm">
            <DynamicCodeBlock
              lang="bash"
              code={`npm install --save-dev damian && npm install @damiandb/pg`}
            />
          </Tab>
          <Tab value="pnpm">
            <DynamicCodeBlock
              lang="bash"
              code={`pnpm add -D damian && pnpm add @damiandb/pg`}
            />
          </Tab>
          <Tab value="yarn">
            <DynamicCodeBlock
              lang="bash"
              code={`yarn add -D damian && yarn add @damiandb/pg`}
            />
          </Tab>
        </Tabs>

        <p>
          <Link href="/docs/fundamentals/quickstart">Get Started →</Link>
        </p>
      </article>
    </main>
  );
}
