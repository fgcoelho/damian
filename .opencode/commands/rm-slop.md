---
description: Remove AI code slop
model: github-copilot/grok-code-fast-1
---

Check current changes, identify all slop, and remove it while preserving intended behavior.

Slop includes:
- Any kind of code commenting that is not already normal for that file
- Extra defensive checks or try/catch blocks that are abnormal for that area of the codebase (especially if called by trusted or validated codepaths)
- Casts to any used to bypass type issues
- Style that is inconsistent with the file
- Unnecessary emoji usage

Operating method:
1. Review the diff against dev and scan for slop patterns above.
2. Remove slop while keeping functional intent intact.
3. Match local style and conventions; do not introduce new patterns.
4. Do not add new comments unless they already exist in that file.