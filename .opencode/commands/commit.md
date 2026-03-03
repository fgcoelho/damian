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
git commit -m "type: user-facing impact description"
```

## Commit Message Format

Each commit message must follow:

```
type: short description (50 chars or less)

Detailed explanation of WHY the change was made.
- List of what changed
- Impact on the system
```

## Examples

**Good commit**:

```
feat: add two-factor authentication

Implements TOTP-based 2FA to improve account security.
Users can enable 2FA in account settings.
```

**Good commit**:

```
fix: resolve slow dashboard load time

Replaced N+1 queries with single aggregated query.
Reduces page load from 3s to 200ms.
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

## Return Value

After completing, return a summary of commits created:

- List of commit messages
- Files affected by each commit
- Any warnings about mixed concerns
