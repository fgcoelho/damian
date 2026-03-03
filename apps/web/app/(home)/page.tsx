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
          No schema diffing. No shadow databases. No "push" shortcuts. Just raw
          SQL and a single workflow.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 not-prose my-8">
          <Link
            href="/docs/fundamentals/quickstart"
            className="inline-flex items-center px-6 py-3 bg-fd-primary text-fd-primary-foreground font-semibold rounded-lg hover:bg-fd-primary/90 transition-colors no-underline"
          >
            Get Started <ArrowUpRightIcon className="size-4 ml-2" />
          </Link>
          <Link
            href="/docs/"
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
              No Schema DSL
            </h3>
            <p className="text-fd-muted-foreground text-sm">
              Stop modeling your database in TypeScript just to generate SQL.
              Write SQL directly. Let the types be derived from it.
            </p>
          </div>
          <div className="border border-fd-border rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-base inline-flex items-center">
              <Icon icon="ShieldCheck" className="size-5 mr-2" />
              No Diff Magic
            </h3>
            <p className="text-fd-muted-foreground text-sm">
              No schema diff engine guessing renames or constraint intent.
              Migrations are explicit, deterministic, and reviewable.
            </p>
          </div>
          <div className="border border-fd-border rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-base inline-flex items-center">
              <Icon icon="Wrench" className="size-5 mr-2" />
              SQL + Type Safety
            </h3>
            <p className="text-fd-muted-foreground text-sm">
              Write real SQL with template literals and keep full type safety.
              Compile-time validation comes from your actual schema.
            </p>
          </div>
        </div>

        <h2>Quick Example</h2>

        <Tabs
          groupId="operation"
          persist
          items={["SELECT", "INSERT", "UPDATE"]}
        >
          <Tab value="SELECT">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from '@damiandb/pg'
import { UserTable, PostTable } from '@generated/damian'

// Simple query with type safety
const userId = '123e4567-e89b-12d3-a456-426614174000'

const query = sql(UserTable)\`
  SELECT *
  FROM \${UserTable}
  WHERE \${UserTable.id} = \${userId}
\`

const { rows } = await db.query(query)
const user = rows[0] // Fully typed!

// Relational queries
const relationQuery = sql({
  user: UserTable.schema,
  posts: PostTable.schema.array()
})\`
  SELECT 
    \${sql.select(UserTable)},
    \${sql.selectArray(PostTable)}
  FROM \${UserTable}
  LEFT JOIN \${PostTable} 
    ON \${UserTable.alias.id} = \${PostTable.alias.user_id}
  WHERE \${UserTable.phone_number} = '+1234567890'
\`

const { user, posts } = await db.query(relationQuery)`}
            />
          </Tab>
          <Tab value="INSERT">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from './database'
import { UserTable } from './damian/schema'

// Single insert
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  phone_number: '+1234567890'
}

const { cols, rows } = UserTable.createRows(userData)

const insertQuery = sql\`
  INSERT INTO \${UserTable} \${sql.cols(cols)} 
  VALUES \${sql.rows(rows)}
\`

await db.query(insertQuery)

// Bulk insert
const users = [
  { name: 'John Doe', email: 'john@example.com' },
  { name: 'Jane Smith', email: 'jane@example.com' },
  { name: 'Bob Johnson', email: 'bob@example.com' }
]

const { cols: bulkCols, rows: bulkRows } = UserTable.createRows(users)

const bulkQuery = sql\`
  INSERT INTO \${UserTable} \${sql.cols(bulkCols)} 
  VALUES \${sql.rows(bulkRows)}
\`

await db.query(bulkQuery)`}
            />
          </Tab>
          <Tab value="UPDATE">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from './database'
import { UserTable } from './damian/schema'

// Update with helper methods
const userId = '123e4567-e89b-12d3-a456-426614174000'
const updateData = {
  name: 'John Updated',
  phone_number: '+1987654321'
}

const { cols, rows } = UserTable.createRows(updateData)

const updateQuery = sql\`
  UPDATE \${UserTable}
  SET \${sql.updateCols(cols)}
  WHERE \${UserTable.id} = \${userId}
\`

await db.query(updateQuery)

// Upsert (insert with conflict resolution)
const upsertQuery = sql\`
  INSERT INTO \${UserTable} \${sql.cols(cols)}
  VALUES \${sql.rows(rows)}
  ON CONFLICT (\${UserTable.email}) DO UPDATE
  SET \${sql.excludedCols(cols, ["id", "created_at"])}
\`

await db.query(upsertQuery)`}
            />
          </Tab>
        </Tabs>

        <h2>Installation</h2>

        <Tabs items={["npm", "pnpm", "yarn", "bun"]}>
          <Tab value="npm">
            <DynamicCodeBlock lang="bash" code={`npm i --save-dev damian`} />
          </Tab>
          <Tab value="pnpm">
            <DynamicCodeBlock lang="bash" code={`pnpm add -D damian`} />
          </Tab>
          <Tab value="yarn">
            <DynamicCodeBlock lang="bash" code={`yarn add -D damian`} />
          </Tab>
          <Tab value="bun">
            <DynamicCodeBlock lang="bash" code={`bun add -d damian`} />
          </Tab>
        </Tabs>

        <p>
          <Link href="/docs/quickstart">Get Started →</Link>
        </p>
      </article>
    </main>
  );
}
