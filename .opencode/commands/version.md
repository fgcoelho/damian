---
name: version
description: analyze changes, write changelog, bump versions, create tags
callable: true
subagent_type: "*"
model: github-copilot/gpt-5-mini
---

# Version Command

Analyze recent changes, write changelogs, bump package versions, and create git tags. This command does NOT commit or push — the `/commit` command handles that.

## Execution Steps

### Step 1: Understand what changed

Run:

```bash
git log --oneline -10
git diff HEAD~1 --stat
```

Identify which packages were touched: `packages/cli` and/or `packages/pg`. The `apps/web` package is ignored by changesets per `.changeset/config.json`.

To determine the baseline, find the last version commit or tag for each package:

```bash
git tag --sort=-v:refname | grep -E '^(damian|@damiandb/pg)@' | head -5
```

Then inspect commits since that tag:

```bash
git log <tag>..HEAD --oneline -- packages/cli
git log <tag>..HEAD --oneline -- packages/pg
```

Only packages with user-facing commits since their last tag need a changeset.

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

### Step 6: Create git tags

Read the new versions from the bumped `package.json` files:

```bash
node -p "require('./packages/cli/package.json').version"
node -p "require('./packages/pg/package.json').version"
```

Compare against the latest existing tags. Create a tag for each package whose version increased:

- `damian@<version>` for `packages/cli`
- `@damiandb/pg@<version>` for `packages/pg`

```bash
git tag <package>@<version>
```

Do not re-tag an existing version. Only tag packages whose version actually changed.

### Step 7: Verify

Run:

```bash
pnpm changeset status
git tag --sort=-v:refname | head -10
```

Confirm no pending changesets remain and tags exist locally.

## Key Rules

- Never use `changeset add` interactively — always write the file directly
- The slug should be descriptive, lowercase, hyphenated (e.g., `fix-generate-hang.md`)
- Do not create a changeset for changes that only affect `apps/web`, tests, or internal tooling with no user-facing impact
- One changeset per logical release unit — if two packages changed in one logical feature, one changeset file covering both is correct
- Do not bump `major` unless something genuinely breaks existing usage
- **Do not commit** — leave all changes (package.json, CHANGELOG.md) as unstaged modifications
- **Do not push** — tags are local-only until `/commit` pushes them
- After this command completes, the user should run `/commit` to commit the version bump and push tags

## Return Value

Return nothing.