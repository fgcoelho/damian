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
          <strong>Easy migrations and typesafe queries with raw SQL</strong>
        </p>

        <p>
          No schema DSL. No diff engine. No "push" shortcut. One workflow, from
          local to production.
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
              SQL as source of truth
            </h3>
            <p className="text-fd-muted-foreground text-sm">
              Write SQL → get types. Not the other way around.
            </p>
          </div>
          <div className="border border-fd-border rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-base inline-flex items-center">
              <Icon icon="ShieldCheck" className="size-5 mr-2" />
              One workflow
            </h3>
            <p className="text-fd-muted-foreground text-sm">
              No 'push', no 'migrate dev', only 'migrate'.
            </p>
          </div>
          <div className="border border-fd-border rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-base inline-flex items-center">
              <Icon icon="Wrench" className="size-5 mr-2" />
              Query safety
            </h3>
            <p className="text-fd-muted-foreground text-sm">
              Write queries with typesafe helpers and parameterization.
            </p>
          </div>
        </div>

        <h2>Installation</h2>

        <Tabs items={["npm", "pnpm", "yarn"]}>
          <Tab value="npm">
            <DynamicCodeBlock
              lang="bash"
              code={`npm install -D damian && npm install @damiandb/pg`}
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
import { UsersTable } from 'tables'

const searchParams = { email: "alice@example.com" }

// no, this won't cause SQL injection
const { rows } = await db.query(sql(UsersTable)\`
    SELECT * FROM \${UsersTable}
    WHERE \${UsersTable.email} = \${searchParams.email}
\`)

// row is typed as { id: number, name: string, email: string }
const user = rows[0]`}
            />
          </Tab>
          <Tab value="INSERT">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from './db'
import { UsersTable } from 'tables'

const { cols, row } = UsersTable.createRow({ name: "Alice", email: "alice@example.com" })

await db.query(sql\`
    INSERT INTO \${UsersTable} \${sql.tuple(cols)}
    VALUES \${sql.tuple(row)}
\`)`}
            />
          </Tab>
          <Tab value="UPDATE">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from './db'
import { UsersTable } from 'tables'

const formInput = { name: "Alice Renamed" }

await db.query(sql\`
    UPDATE \${UsersTable}
    SET \${UsersTable.name} = \${formInput.name}
    WHERE \${UsersTable.id} = \${1}
\`)`}
            />
          </Tab>
          <Tab value="DELETE">
            <DynamicCodeBlock
              lang="ts"
              code={`import { db, sql } from './db'
import { PostsTable } from 'tables'

const post = { id: 42 }

await db.query(sql\`
    DELETE FROM \${PostsTable}
    WHERE \${PostsTable.id} = \${post.id}
\`)`}
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
