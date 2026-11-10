---
name: spec-workflow
description: Drafts feature specifications, architecture plans, and acceptance tests in strict read-only mode prior to code generation.
---

# Procedure: Task Spec & Acceptance Criteria Drafting

## Strict Constraint: Read-Only Phase
You are strictly forbidden from modifying or creating project implementation code files while executing this skill. Your only file write target is `specs/[feature-name].md`.

## Execution Steps
1. Create or update `specs/[feature-name].md` with:
   - **User Story:** Plain-language summary of what should happen from the user's perspective.
   - **Acceptance Criteria:** Checkbox list (`- [ ]`) of deterministic behaviors that define completion.
   - **Affected Files:** Predicted list of files to create, modify, or delete.
   - **Acceptance Tests:** Sample test cases, inputs, expected outputs, and edge cases.
   - **Potential Risks / Edge Cases:** Security implications, breaking schema changes, or performance bottlenecks.
2. Pause and present the drafted specification to the user.
3. **DO NOT** proceed to code implementation until the user explicitly responds with approval (e.g., "Approved" or "Proceed").
4. **Branch & Worktree Initialization:** Upon user approval, check current git branch (`git branch --show-current`). If on `main` or `master`, automatically create and switch to a dedicated feature branch: `git checkout -b feat/[feature-slug]`. For concurrent subagents, initialize an isolated worktree (`Workspace: 'share'`).

