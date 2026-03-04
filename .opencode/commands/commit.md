---
name: commit
description: Smart commit analyzer with version-aware tagging
callable: true
subagent_type: "*"
model: github-copilot/gpt-5-mini
---

# Smart Commit Command

Analyze pending changes and divide them into logical, atomic commits following conventional commits format. When version bumps are present, commit them separately and push their tags.

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

### Step 2: Detect Version Bump Files

Check whether `/version` was run before this command by looking for modified version files:

```bash
git diff --name-only | grep -E '(CHANGELOG\.md|package\.json)' | grep -v pnpm-lock
```

If changes include `packages/cli/CHANGELOG.md`, `packages/cli/package.json`, `packages/pg/CHANGELOG.md`, or `packages/pg/package.json`, these are version bump artifacts. They must be committed in a dedicated version commit (see Step 4).

Also check for local tags that have not been pushed:

```bash
git tag --sort=-v:refname | head -10
git ls-remote --tags origin 2>/dev/null | awk '{print $2}' | sed 's|refs/tags/||'
```

### Step 3: Identify Logical Groups (Non-Version Changes)

Categorize all remaining (non-version) changes by type:

- **feat**: New user-facing functionality
- **fix**: Bug fixes
- **docs**: Documentation, README, comments
- **refactor**: Internal changes without behavior change
- **test**: Adding/modifying tests
- **style**: Formatting, linting, code style (no logic change)
- **chore**: Configuration, dependencies, CI/CD

### Step 4: Commit Non-Version Changes First

For each logical group of non-version changes, execute:

```bash
git add [specific files for this group]
git commit -m "type(scope): user-facing impact description"
```

Do NOT include version bump files (CHANGELOG.md, package.json from packages/) in these commits.

### Step 5: Commit Version Bump

If version bump files were detected in Step 2, commit them as a single dedicated commit:

```bash
git add packages/cli/package.json packages/cli/CHANGELOG.md
git add packages/pg/package.json packages/pg/CHANGELOG.md
git commit -m "chore(cli,pg): version packages"
```

Adjust the scope to match which packages were actually bumped. If only one package was bumped, use that package's scope:

```
chore(cli): version packages
chore(pg): version packages
chore(cli,pg): version packages
```

### Step 6: Push Tags

After the version commit exists, push any unpushed tags that match the current package versions:

```bash
node -p "require('./packages/cli/package.json').version"
node -p "require('./packages/pg/package.json').version"
```

```bash
git push origin damian@<version> @damiandb/pg@<version>
```

Only push tags for packages whose version was bumped in this session.

### Step 7: Verify

```bash
git status
git tag --sort=-v:refname | head -10
git log --oneline -5
```

Confirm working tree is clean, tags exist, and commits are in history.

## Commit Message Format

Each commit message must follow:

```
type(scope): short description (50 chars or less)
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

**Version bump**:

```
chore(cli,pg): version packages
```

## Key Principles

**DO:**

- Keep commits atomic and focused on one logical change
- Write clear, descriptive messages
- Include WHY the change was made, not just WHAT
- Stage files intentionally by group
- Run `git status` after each commit to verify state
- Commit version bump files separately from feature/fix changes
- Push tags only after the version commit is created

**DON'T:**

- Mix version bump files with unrelated changes in one commit
- Mix multiple unrelated changes in one commit
- Write vague messages like "fix stuff" or "updates"
- Stage all files without thinking about logical grouping
- Include debug code, console logs, or temporary fixes
- Commit without verifying the changes with `git diff --cached`
- Create or modify git tags — that is the `/version` command's job

## Return Value

After completing, return a summary of:

- List of commit messages
- Files affected by each commit
- Any git tags pushed
- Any warnings about mixed concerns
