---
name: version
description: Create a changeset, bump versions, tag and release
callable: true
subagent_type: "*"
model: github-copilot/gpt-5-mini
---

# Version Command

Analyze recent changes, create a changeset, bump versions, commit, tag, and prepare a release.

## Execution Steps

### Step 1: Understand what changed

Run:

```bash
git log --oneline -10
git diff HEAD~1 --stat
```

Identify which packages were touched: `packages/cli` and/or `packages/pg`. The `apps/web` package is ignored by changesets per `.changeset/config.json`.

### Step 2: Determine bump type per package

For each affected package, decide:

- **major**: Breaking change — removed export, changed function signature, incompatible behavior change
- **minor**: New feature — new export, new command, new option, backward-compatible addition
- **patch**: Bug fix or internal improvement with no API surface change

### Step 3: Write a concise summary

The changeset summary should describe the change from the user's perspective, not the implementation. One or two sentences. No bullet lists.

Examples of good summaries:
- `Fix generate command hanging indefinitely when worker entry had no executable code.`
- `Add Prettify<T> type to normalize inferred row types in query results.`
- `Replace single-select with multi-select for sandbox populator prompts.`

### Step 4: Create the changeset file

Write the file directly to `.changeset/<descriptive-slug>.md`. Do not use `changeset add` interactively — write the file with the Write tool instead.

The format is:

```md
---
"package-name": minor
---

Summary of the change from the user's perspective.
```

Use the exact package names from `package.json` (`"damian"` for cli, `"@damiandb/pg"` for pg).

If multiple packages changed at different bump levels, include both:

```md
---
"damian": patch
"@damiandb/pg": minor
---

Summary covering both changes.
```

### Step 5: Bump versions

Run:

```bash
pnpm bump
```

This runs `changeset version`, which consumes the changeset files, updates `package.json` versions in affected packages, and updates `CHANGELOG.md` files. The `.changeset/*.md` files are deleted automatically.

### Step 6: Commit the version bump

```bash
git add -A
git commit -m "chore: version packages"
```

### Step 7: Create git tags

Read the new versions from the bumped `package.json` files:

```bash
node -p "require('./packages/cli/package.json').version"
node -p "require('./packages/pg/package.json').version"
```

Create a tag for each package that was bumped. Use the format `<package-name>@<version>`:

- `damian@<version>` for `packages/cli`
- `@damiandb/pg@<version>` for `packages/pg`

```bash
git tag <package>@<version>
```

Only tag packages whose version actually changed — compare against the previous version visible in `git log --oneline -5` or the prior tag.

### Step 8: Verify

Run:

```bash
pnpm changeset status
git tag --sort=-v:refname | head -10
git log --oneline -5
```

Confirm no pending changesets remain, tags exist, and the version commit is in history.

## Key Rules

- Never use `changeset add` interactively — always write the file directly
- The slug should be descriptive, lowercase, hyphenated (e.g., `fix-generate-hang.md`)
- Do not create a changeset for changes that only affect `apps/web`, tests, or internal tooling with no user-facing impact
- One changeset per logical release unit — if two packages changed in one logical feature, one changeset file covering both is correct
- Do not bump `major` unless something genuinely breaks existing usage
- Do not push tags or commits to remote unless the user explicitly asks to release/publish

## Return Value

Return:

- The changeset file path and its contents
- New versions for each bumped package
- Git tags created
- Output of `git log --oneline -5`
