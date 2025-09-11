# 🌳 Damian: Type-Safe SQL Query Builder

Damian is a TypeScript-first SQL query builder that generates types from your SQL schema files. It's designed to provide type safety while keeping you close to raw SQL.

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

## Features

- 🔒 **Type-safe queries** - Generated types from your SQL schema
- 📝 **SQL-first approach** - Write actual SQL, get TypeScript types
- 🏗️ **Multiple database support** - PostgreSQL, MySQL, and SQLite
- 🔗 **Relational queries** - Built-in support for joins and nested data
- 🛡️ **Multiple schema validators** - Zod, Valibot, ArkType, and TypeMap support
- 🚀 **Zero runtime overhead** - Pure SQL generation with TypeScript safety

## Quick Start

### Installation

```bash
# npm
npm install damian

# pnpm
pnpm add damian

# yarn
yarn add damian
```

### Configuration

Create a configuration file in your project root:

```ts
// damian.config.ts
import type { Config } from 'damian'

export default {
    sql: "./damian/schema.sql",
    types: "./damian/schema.ts",
    database: "postgres", // "postgres" | "mysql" | "sqlite"
    schema: "zod" // "zod" | "valibot" | "arktype" | "typemap"
} satisfies Config
```

### Schema Definition

Damian uses a SQL file as the single source of truth for generating TypeScript types. You can create this file manually or generate it using migration tools like `dbmate`:

```sql
-- damian/schema.sql
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
```

### Generate Types

Run the following command to generate TypeScript types from your SQL schema:

```bash
npx damian generate
```

This will create type definitions in the file specified by your `types` configuration option.

## Usage Guide

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

const user = rows[0] // Fully typed based on your schema

console.log(user.name) // TypeScript knows this exists and its type
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

When you need to join the same table multiple times, use aliases:

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
    ON CONFLICT (email) DO UPDATE
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

// Delete users who haven't been active for over a year
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

// Delete posts from users who are no longer active
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
    WHERE ${PostTable.created_at} < NOW() - INTERVAL '2 years'
    RETURNING ${PostTable.id}, ${PostTable.title}
`

const result = await db.query(query)
```

## Contributing

Contributions are welcome!

## License

MIT License - see LICENSE file for details.