---
name: commit
description: Smart commit analyzer
callable: true
subagent_type: "*"
model: github-copilot/gpt-5-mini
---

# Smart Commit Command

Analyze pending changes and divide them into logical, atomic commits following conventional commits format.

## How to Call This Command

Subagents can invoke this command using the Task tool:

```
task(
  description: "Create atomic commits for changes",
  prompt: "/commit",
  subagent_type: "developer"
)
```

## Execution Steps

### Step 1: Analyze Current State

Run:

```bash
git status --short
git diff --stat
```

Understand what files changed and their size/impact.

### Step 2: Identify Logical Groups

Categorize changes by type:

- **feat**: New user-facing functionality
- **fix**: Bug fixes
- **docs**: Documentation, README, comments
- **refactor**: Internal changes without behavior change
- **test**: Adding/modifying tests
- **style**: Formatting, linting, code style (no logic change)
- **chore**: Configuration, dependencies, CI/CD

### Step 3: Create Atomic Commits

For each logical group, execute:

```bash
git add [specific files for this group]
git commit -m "type(scope): user-facing impact description"
```

## Commit Message Format

Each commit message must follow:

```
type(scope): short description (50 chars or less)

Detailed explanation of WHY the change was made.
- List of what changed
- Impact on the system
```

### Monorepo Scopes

This is a monorepo. Always include a scope that identifies where the change lives:

| Scope       | When to use                                              |
| ----------- | -------------------------------------------------------- |
| `cli`       | Changes under `packages/cli/`                            |
| `pg`        | Changes under `packages/pg/`                             |
| `web`       | Changes under `apps/web/`                                |
| `root`      | Root-level files: `package.json`, `pnpm-lock.yaml`, `turbo.json`, `.changeset/`, etc. |
| `cli,pg`    | Changes that span multiple packages in a single commit   |

When a commit touches only one package, use that package's scope. When it touches root config files alongside package files, use `root` or a combined scope.

## Examples

**Single package**:

```
feat(pg): add Prettify<T> to normalize inferred row types
```

```
fix(cli): resolve generate command hanging when worker has no executable code
```

**Root-level**:

```
chore(root): update turbo pipeline and lockfile
```

**Cross-package**:

```
chore(cli,pg): version packages to 0.0.3
```

## Key Principles

**DO:**

- Keep commits atomic and focused on one logical change
- Write clear, descriptive messages
- Include WHY the change was made, not just WHAT
- Stage files intentionally by group
- Run `git status` after each commit to verify state

**DON'T:**

- Mix multiple unrelated changes in one commit
- Write vague messages like "fix stuff" or "updates"
- Stage all files without thinking about logical grouping
- Include debug code, console logs, or temporary fixes
- Commit without verifying the changes with `git diff --cached`

## Step 4: Create Git Tags for Version Bumps

After all commits are created, check whether any package versions were bumped in this session.

Read the current versions:

```bash
node -p "require('./packages/cli/package.json').version"
node -p "require('./packages/pg/package.json').version"
```

List existing tags to find the last tag per package:

```bash
git tag --sort=-v:refname | grep -E '^(damian|@damiandb/pg)@'
```

If a package version is **higher** than its most recent tag (or has no tag at all), create a tag:

```bash
git tag damian@<version>       # for packages/cli
git tag @damiandb/pg@<version> # for packages/pg
```

Only tag packages whose version actually increased. Do not re-tag an existing version.

Then push the tags to the remote:

```bash
git push origin <tag1> <tag2>
```

Verify:

```bash
git tag --sort=-v:refname | head -10
git ls-remote --tags origin
```

## Return Value

After completing, return a summary of:

- List of commit messages
- Files affected by each commit
- Any git tags created
- Any warnings about mixed concerns
