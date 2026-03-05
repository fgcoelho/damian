# @damiandb/pg

## 0.0.6

### Patch Changes

- Improve `sql` tag APIs:
    - Deprecated `sql.comma` in favor of `sql.join.comma` for better consistency with other join types.
    - Added `sql.join.or` and `sql.join.and` for joining SQL fragments with "OR" and "AND" respectively.
    - Added `sql.map` for improving readability when mapping over arrays to create SQL fragments.

## 0.0.5

### Patch Changes

- Reduce bundle size and dependency count by removing useless dependencies.

## 0.0.4

### Patch Changes

- Improve type generation and typings imports in the CLI, and fix SQL tag typing and parser validation in the PostgreSQL driver.

## 0.0.3

### Patch Changes

- Fix SQL tag typing and table schema exposure so untyped template literals may be passed to the query API and table schemas expose column-level standard schemas.

## 0.0.2

### Patch Changes

- Prepare release: apply recent bug fixes and internal refactors across the CLI and pg driver.

## 0.0.1

### Patch Changes

- first version
