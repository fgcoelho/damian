---
name: commit
description: Smart commit analyzer with version-aware tagging
callable: true
subagent_type: "*"
model: github-copilot/gpt-5-mini
---

# Commit Command

Analyze pending changes, divide them into logical atomic commits, and push version tags when present.

## Steps

### 1. Analyze

```bash
git status --short
git diff --stat
git diff --name-only | grep -E '(CHANGELOG\.md|package\.json)' | grep -v pnpm-lock
```

Separate version bump files (CHANGELOG.md, package.json from `packages/`) from everything else.

### 2. Commit non-version changes

Group remaining changes by logical concern. For each group:

```bash
git add <files>
git diff --cached
git commit -m "type(scope): subject line here"
```

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`, `ci`, `chore`, `revert`.

### 3. Commit version bump (if present)

```bash
git add packages/*/package.json packages/*/CHANGELOG.md
git commit -m "chore(scope): Version packages"
```

Scope matches bumped packages: `cli`, `pg`, or `cli,pg`.

### 4. Push tags (if present)

```bash
git tag --sort=-v:refname | head -5
git push origin <unpushed tags>
```

### 5. Verify

```bash
git status
git log --oneline -5
```

## Commit Message Rules

Subject line format — **50 characters maximum, single line only**:

```
type(scope): message
```

The subject must read naturally after "If applied, this commit will ...". Write "add feature", not "added feature" or "adding feature" or "adds feature".

Before committing, check length:

```bash
SUBJECT="type(scope): message"
if [ ${#SUBJECT} -gt 50 ]; then
  echo "ERROR: Subject exceeds 50 chars (${#SUBJECT})"
  exit 1
fi
git commit -m "$SUBJECT"
```

Rules:

- Single line only — no body, no wrapping
- Maximum 50 characters total
- Lowercase the message after the colon
- No period at the end
- One logical change per commit
- Never mix version bumps with other changes
- If unsure which type fits, the commit is too large — split it

### Types

| Type       | When to use                                                        |
| ---------- | ------------------------------------------------------------------ |
| `feat`     | New feature or user-facing addition                                |
| `fix`      | Bug fix that corrects unexpected behaviour                         |
| `refactor` | Code change with no logic or API surface impact                    |
| `perf`     | Change that improves performance                                   |
| `test`     | Adding or changing tests only                                      |
| `docs`     | End user documentation only                                        |
| `style`    | Formatting, whitespace, lint — no logic change                     |
| `build`    | Build process or production dependency change (impacts the system) |
| `chore`    | Dev tooling, config, or dev-dependency change (no system impact)   |
| `ci`       | CI configuration files                                             |
| `revert`   | Reverts a previous commit                                          |

`build` vs `chore`: use `build` when the change affects what ships or how it compiles; use `chore` for anything that only affects the development environment.

### Scopes

Multiple scopes are separated with `,` (e.g. `cli,pg`). Separators `/` and `\` are also valid per the spec but `,` is preferred here.

| Scope    | Path                 |
| -------- | -------------------- |
| `cli`    | `packages/cli/`      |
| `pg`     | `packages/pg/`       |
| `web`    | `apps/web/`          |
| `root`   | Root config files    |
| `cli,pg` | Multiple packages    |

## Examples

```
feat(pg): add prettify type helper
```

```
fix(cli): resolve hanging on empty worker
```

```
refactor(pg): replace nulls with result type
```

```
chore(cli,pg): version packages
```

## Return Value

Return nothing.