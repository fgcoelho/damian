---
name: commit
description: smart commit analyzer
callable: true
subagent_type: "*"
model: github-copilot/gpt-5-mini
---

# Guardrails

1. Never use git reset or git revert without explicit instructions to do so.
2. Never amend or rewrite history of commits that have been pushed to a shared repository.
3. Always follow the commit message rules strictly, even if it contradicts previous commits.
4. Never push commits, leave that to the user after the commit messages are finalized.

# Commit Command

Analyze pending changes, divide them into logical atomic commits.

## Steps

### 1. Analyze

```bash
git status --short
git diff --stat
```

### 2. Commit non-version changes

Group remaining changes by logical concern. For each group:

```bash
git add <files>
git diff --cached
git commit -m "type: subject line here"
```

### 3. Verify

```bash
git status
git log --oneline -5
```

## Commit Message Format

Subject line format — **50 characters maximum, single line only**:

```
type: subject
```

The subject must read naturally after "If applied, this commit will ...". Write "add feature", not "added feature" or "adding feature" or "adds feature".

Before committing, check length:

```bash
LINE="type: subject"

SUBJECT="${LINE#*: }"   # everything after ": "

if [ ${#SUBJECT} -gt 50 ]; then
  echo "ERROR: Subject exceeds 50 chars (${#SUBJECT})"
  exit 1
fi

git commit -m "$LINE"
```

### Format

- Single line only — no body, no wrapping
- Maximum 50 characters total
- Lowercase the message after the colon
- No period at the end
- One logical change per commit
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

## Examples

```
feat: add prettify type helper
```

```
fix: resolve hanging on empty worker
```

```
refactor: replace nulls with result type
```

```
chore: version packages
```

## Monorepo Instructions

When working in a monorepo, include the package name in the subject line:

```
feat(core): add prettify type helper
```

Never include more than one package in a single commit like `feat(core, cli): add prettify type helper`, as this indicates the commit is not atomic.

If the change affects multiple packages, split it into multiple commits.

In case of a change that affects the root of the monorepo, use the package name `root`:

```
fix(root): resolve hanging on empty worker
```

## Versioning Instructions

When the changes include version bumps, always commit the code changes first, and then, at last, commit the version bump.

Version bumps and changelog updates must be commited together, and separately from code changes.

Always check for git tags to push after commiting a version bump, and check if they need to be fixed.

## Return Value

Return nothing.