# 🌳 Damian: the sql first framework.

Damian is the last Javascript database framework you will ever need, and that's because **it is not an orm** and **it is not a query builder**.

Backed by battle-tested frameworks such as [dbmate](dbmate) and [slonik](slonik), Damian powers the writing of raw SQL with full typesafety throughout your whole codebase.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Schema Definition](#schema-definition)
  - [Generate Types](#generate-types)
- [Usage Guide](#usage-guide)
  - [SELECT Queries](#select-queries)
    - [Single Table Queries](#single-table-queries)
    - [Relational Queries](#relational-queries)
    - [Table Aliases](#table-aliases)
  - [INSERT Operations](#insert-operations)
    - [Standard Insert](#standard-insert)
    - [Bulk Insert](#bulk-insert)
    - [Upsert (Insert with Conflict Resolution)](#upsert-insert-with-conflict-resolution)
  - [UPDATE Operations](#update-operations)
    - [Single Record Update](#single-record-update)
    - [Conditional Update](#conditional-update)
  - [DELETE Operations](#delete-operations)
    - [Delete by ID](#delete-by-id)
    - [Conditional Delete](#conditional-delete)
    - [Delete with Joins (PostgreSQL)](#delete-with-joins-postgresql)
    - [Bulk Delete with Return Values](#bulk-delete-with-return-values)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

### Installation

#### damian

```bash
# npm
npm install damian

# pnpm
pnpm add damian

# yarn
yarn add damian
```

#### cli (optional)

Damian CLI is a thin wrapper around [dbmate](dbmate) to manage your migrations.

It is not mandatory, you can use whatever migration tool you prefer.

```bash
# npm
npm install @damiandb/cli -D

# pnpm
pnpm add @damiandb/cli -D

# yarn
yarn add @damiandb/cli -D
```

### Configuration

Create a configuration file in your project root:

```ts
// damian.config.ts
import type { Config } from 'damian'

export default {
    root: "./damian",
    database: "postgres",
    schema: "zod"
} satisfies Config
```

### SQL First Approach

Damian reads all migrations and generates typings without requiring a running SQL server.

By default, your files should follow the [dbmate](https://github.com/amacneil/dbmate) format:

```sql
-- migrate:up

...

-- migrate:down

...
```

In case you are using a separate migration tool, see [custom migration formats](https://damian.dev/docs/configuration#custom-migration-formats) for customization options.

To start, run ``damian new initial`` to create your first migration file, then start writing:

```sql
-- damian/.migrations/0001_initial.sql

-- migrate:up
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- migrate:down
```

### Generate Types


Run the following command to generate TypeScript types from your SQL schema:

```bash
pnpm damian generate
```

This will create type definitions under root `__generated__/schema.ts`.

## Usage Guide

### Client

```ts
// database.ts
import { createDb } from '@damiandb/pg'

export const db = createDb({
    connectionString: process.env.DATABASE_URL as string,
})
```

### SELECT Queries

#### Single Table Queries

```ts
import { db } from './database'
import { sql } from 'damian'
import { UserTable } from './damian/schema'

const userId = '123e4567-e89b-12d3-a456-426614174000'

const query = sql.table(UserTable)`
    SELECT *
    FROM ${UserTable}
    WHERE ${UserTable.id} = ${userId}
`

const { rows } = await db.query(query)

// Fully typed based on your schema
const user = rows[0]
```

#### Relational Queries

```ts
import { db } from './database'
import { sql } from 'damian'
import { UserTable, PostTable } from './damian/schema'

const phoneNumber = '+1234567890'

const query = sql.relational({
    user: UserTable.schema,
    posts: PostTable.schema.array()
})`
    SELECT 
        ${sql.selectTable(UserTable)},
        ${sql.selectAggregate(PostTable)}
    FROM ${UserTable}
    INNER JOIN ${PostTable} 
        ON ${UserTable.alias.id} = ${PostTable.alias.user_id}
    WHERE ${UserTable.phone_number} = ${phoneNumber}
`

const { rows } = await db.query(query)

// Both user and posts are fully typed
const { user, posts } = rows[0]
```

#### Table Aliases

When you need to join multiple tables, use aliases:

```ts
import { db } from './database'
import { sql } from 'damian'
import { ProjectTable, UserTable } from './damian/schema'

const manager = sql.alias(UserTable, "manager")
const reviewer = sql.alias(UserTable, "reviewer")
const project = sql.alias(ProjectTable, "project")

const projectId = 1

const query = sql.relational({
    project: ProjectTable.schema,
    manager: UserTable.schema,
    reviewer: UserTable.schema,
})`
    SELECT
        ${sql.selectTable(project)},
        ${sql.selectTable(manager)},
        ${sql.selectTable(reviewer)}
    FROM ${project}
    INNER JOIN ${manager} 
        ON ${project.manager_user_id} = ${manager.id}
    INNER JOIN ${reviewer} 
        ON ${project.reviewer_user_id} = ${reviewer.id}
    WHERE ${project.id} = ${projectId}
`

const { rows } = await db.query(query)

const { 
    project: projectData, 
    manager: managerData, 
    reviewer: reviewerData 
} = rows[0]
```

### INSERT Operations

#### Standard Insert

```ts
import { db } from './database'
import { sql } from 'damian'
import { UserTable } from './damian/schema'

const userData = {
    name: 'John Doe',
    email: 'john@example.com',
    phone_number: '+1234567890'
}

const { cols, rows } = UserTable.createRows(userData)

const query = sql.void`
    INSERT INTO ${UserTable} ${sql.cols(cols)} 
    VALUES ${sql.rows(rows)}
`

await db.query(query)
```

#### Bulk Insert

```ts
import { db } from './database'
import { sql } from 'damian'
import { UserTable } from './damian/schema'

const users = [
    { name: 'John Doe', email: 'john@example.com' },
    { name: 'Jane Smith', email: 'jane@example.com' },
    { name: 'Bob Johnson', email: 'bob@example.com' }
]

const { cols, rows } = UserTable.createRows(users)

const query = sql.void`
    INSERT INTO ${UserTable} ${sql.cols(cols)} 
    VALUES ${sql.rows(rows)}
`

await db.query(query)
```

#### Upsert (Insert with Conflict Resolution)

```ts
import { db } from './database'
import { sql } from 'damian'
import { UserTable } from './damian/schema'

const userData = {
    name: 'John Doe',
    email: 'john@example.com',
    phone_number: '+1234567890'
}

const { cols, rows } = UserTable.createRows(userData)

const query = sql.void`
    INSERT INTO ${UserTable} ${sql.cols(cols)}
    VALUES ${sql.rows(rows)}
    ON CONFLICT (${UserTable.email}) DO UPDATE
    SET ${sql.excludedCols(cols, ["id", "created_at"])}
`

await db.query(query)
```

### UPDATE Operations

#### Single Record Update

```ts
import { db } from './database'
import { sql } from 'damian'
import { UserTable } from './damian/schema'

const userId = '123e4567-e89b-12d3-a456-426614174000'
const updateData = {
    name: 'John Updated',
    phone_number: '+1987654321'
}

const { cols, rows } = UserTable.createRows(updateData)

const query = sql.void`
    UPDATE ${UserTable}
    SET ${sql.updateCols(cols)}
    WHERE ${UserTable.id} = ${userId}
`

await db.query(query)
```

#### Conditional Update

```ts
import { db } from './database'
import { sql } from 'damian'
import { UserTable } from './damian/schema'

const updateData = { name: 'Updated Name' }
const { cols, rows } = UserTable.createRows(updateData)

const query = sql.void`
    UPDATE ${UserTable}
    SET ${sql.updateCols(cols)}
    WHERE ${UserTable.created_at} < NOW() - INTERVAL '1 year'
    AND ${UserTable.name} IS NOT NULL
`

await db.query(query)
```

### DELETE Operations

#### Delete by ID

```ts
import { db } from './database'
import { sql } from 'damian'
import { UserTable } from './damian/schema'

const userId = '123e4567-e89b-12d3-a456-426614174000'

const query = sql.void`
    DELETE FROM ${UserTable}
    WHERE ${UserTable.id} = ${userId}
`

await db.query(query)
```

#### Conditional Delete

```ts
import { db } from './database'
import { sql } from 'damian'
import { UserTable } from './damian/schema'

const query = sql.void`
    DELETE FROM ${UserTable}
    WHERE ${UserTable.updated_at} < NOW() - INTERVAL '1 year'
    AND ${UserTable.email} NOT LIKE '%@company.com'
`

const result = await db.query(query)
```

#### Delete with Joins (PostgreSQL)

```ts
import { db } from './database'
import { sql } from 'damian'
import { PostTable, UserTable } from './damian/schema'

const query = sql.void`
    DELETE FROM ${PostTable}
    USING ${UserTable}
    WHERE ${PostTable.alias.user_id} = ${UserTable.alias.id}
    AND ${UserTable.updated_at} < NOW() - INTERVAL '6 months'
`

await db.query(query)
```

#### Bulk Delete with Return Values

```ts
import { db } from './database'
import { sql } from 'damian'
import { PostTable } from './damian/schema'

const query = sql.table(PostTable)`
    DELETE FROM ${PostTable}
    WHERE 
    ${PostTable.created_at} < NOW() - INTERVAL '2 years'
    RETURNING ${PostTable.id}, ${PostTable.title}
`

const result = await db.query(query)
```

## Contributing

Contributions are welcome!

## License

MIT License - see LICENSE file for details.