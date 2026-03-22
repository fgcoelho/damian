# AGENTS.md - Damian Development Guidelines

Damian is a TypeScript monorepo — a SQL-first CLI and PostgreSQL driver for database migrations and type generation.

## Useful Commands

| Command              | Purpose                        |
| -------------------- | ------------------------------ |
| `pnpm build`         | Build all packages             |
| `pnpm check`         | Type check + lint all packages |
| `pnpm format`        | Auto-format with Biome         |
| `pnpm test`          | Run all tests                  |

## Clean Code

Load and apply the clean-code skill before writing or refactoring any code:
`.agents/skills/clean-code/SKILL.md`

Key rules:
- Functions do one thing, stay under ~20 lines.
- Names are intention-revealing. No abbreviations.
- No comments — rewrite unclear code instead.
- No side effects in functions.
- Prefer exceptions over null returns or error codes.

## TDD

Follow the three laws:
1. Write a failing test before any production code.
2. Write only enough test to fail.
3. Write only enough production code to pass.

Tests must be F.I.R.S.T.: Fast, Independent, Repeatable, Self-Validating, Timely.

## Guardrails

1. No comments — extract logic into well-named functions instead.
2. No type casts.
3. No emojis.

## General

- Match existing local style exactly.
- No new files unless strictly necessary. Prefer editing existing ones.
