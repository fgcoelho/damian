# AGENTS.md - @damiandb/pg Development Guidelines

`@damiandb/pg` is the PostgreSQL driver — type-safe SQL query builder and table reflection built on Slonik.

## Useful Commands

| Command           | Purpose                  |
| ----------------- | ------------------------ |
| `pnpm check`      | Type check + lint        |
| `pnpm format`     | Auto-format with Biome   |
| `pnpm test`       | Run tests                |
| `pnpm build`      | Build to `dist/`         |

## Guardrails

- `sql/identifier.ts` must not import from `table/` — it exists to break the circular dependency.
- `src/index.ts` is the public API surface. Do not export internals directly.
- `tsc --noEmit` must pass clean before committing.
- Lint runs with `--error-on-warnings`. Use `// biome-ignore` only where `!` is provably safe, with a justification comment.
