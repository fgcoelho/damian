# AGENTS.md - damian CLI Development Guidelines

`damian` is the CLI — database migrations and type generation built on dbmate and oclif.

## Useful Commands

| Command                          | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `pnpm check`                     | Type check + lint                        |
| `pnpm format`                    | Auto-format with Biome                   |
| `pnpm test`                      | Run tests                                |
| `pnpm build`                     | Build to `dist/`                         |

## Guardrails

- Commands in `commands/` are thin oclif adapters — no business logic.
- All business logic lives in `core/`.
- Workers in `workers/` are vite-node entry points — they re-export from `core/`.
- `tsc --noEmit` must pass clean before committing.
- Lint runs with `--error-on-warnings`. Use `// biome-ignore` only where `!` is provably safe, with a justification comment.
