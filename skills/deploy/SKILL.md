---
name: deploy
description: Audits specifications, runs verification gates, executes isolated pre-push code reviews, prompts active recall, deploys commits and tags to GitHub, prunes worktrees, and guarantees the local dev server is running.
---

# Procedure: Automated Verification & Deployment Runbook

Use this skill at the conclusion of a feature implementation or spec session to safely package, audit, verify, and ship code.

## Phase 1: Spec Delta-Sync & Upstream Guard
1. **Locate or Synthesize Spec (`specs/[feature-name].md`):**
   - Identify active feature name from git branch (`feat/[slug]`) or user prompt.
   - **If `specs/[feature-name].md` exists:** Perform a **Delta-Sync**. Scan conversation history and `git diff` for any mid-flight scope additions or architectural decisions agreed upon in chat. Append them under `### Mid-Flight Adjustments & Additions` in the spec file so the reviewer evaluates the actual final intent.
   - **If missing:** Invoke a subagent to synthesize a crisp spec from the session chat and diff. Apply the **Assume & Confirm** rule (infer sensible defaults, maximum 1 round of clarification for true blind spots). Save directly to `specs/[feature-name].md`.
2. **Branch & Upstream Drift Guard:**
   - If on `main` or `master`, create and switch to `feat/[feature-slug]` immediately.
   - Run `git fetch origin`. Check if `origin/main` has advanced while working. If behind, rebase onto `origin/main` before proceeding.

## Phase 2: Deterministic Verification Gate
1. Read commands from `AGENTS.md` (lint, build, test).
2. Execute the verification suite: `npm run lint && npm run build && npm test` (or platform equivalent).
3. If any check fails, HALT deployment immediately and fix implementation code (never weaken tests).

## Phase 3: Isolated Pre-Push Code Review Gate & Local Preview
1. Compile the **Review Brief**:
   - Content of `specs/[feature-name].md` (including all synced mid-flight adjustments).
   - Git diff of the changes (`git diff main...HEAD` or `git diff HEAD~1`).
   - List of touched files.
2. Launch isolated reviewer subagent (`invoke_subagent`):
   - **Role:** `"Senior Code Reviewer"`
   - **TypeName:** `"research"` or `"self"`
   - **Prompt:** Provide **ONLY** the Review Brief. Enforce clean context (zero prior chat transcripts). Instruct to execute `skills/code-review/SKILL.md`.
3. **Local Dev Server & Preview Link Requirement:**
   - At this review stage, ensure the local development server (e.g. Vite on `http://localhost:5173/`) is actively running in the background. If not running, start it immediately via `run_command` with `IsDaemon: true`.
   - **Always present the user with a clickable link to the local app/PWA** (e.g. [http://localhost:5173/](http://localhost:5173/)) so they can test and visually verify the changes in real time alongside the review findings.
4. **Handle Review Results:**
   - **Category 1 (Mechanical Fixes):** Automatically apply fixes (strip unused imports, remove `console.log`, fix formatting) and re-run verification gate silently without interrupting the user.
   - **Category 2 (Needs a Decision):** Present to the user with ELI5 summary and options.
   - **Push Gate:** 
     - **PASS:** Proceed to Phase 4.
     - **PASS WITH RECOMMENDATIONS (Unresolved Category 2) or FAIL / REWORK:** Keep local runtime active for debugging, but **DO NOT push to GitHub**.

## Phase 4: Active Recall & User Approval
1. **Auto-Generate Release Metadata:**
   - Target Git Tag: Kebab-case slug (e.g. `feature-slug-summary`, no spaces to conform to Git ref rules).
   - Commit Title: Conventional commit (`feat: ...`, `fix: ...`).
   - Commit Description: Bullet points of changes.
2. **Present Active Recall Prompt:**
   - Display the drafted commit & tag to the user:
     > *"For codebase retention, describe what changed in your own words, or review the draft below and click Proceed to ship."*
   - Provide an interactive Proceed button (`RequestFeedback: true` artifact or confirmation prompt).

## Phase 5: Git Packaging, Merge & Worktree Cleanup
1. Stage task files: `git add <files>`.
2. Commit: `git commit -m "..."`.
3. **Merge & Push Lifecycle:**
   - Merge `feat/[feature-slug]` into `main` (or push feature branch if using PR workflow).
   - Create annotated tag: `git tag -a "[tag-slug]" -m "[full message]"`.
   - Push to remote: `git push origin main --tags` (or push current branch + tag).
   - **Prune Worktree:** If running inside a temporary worktree, remove it immediately (`git worktree remove`) to maintain zero disk clutter.

## Phase 6: Local Runtime Verification
1. Detect dev server command from `AGENTS.md` (e.g., `npm run dev`, `swift run`).
2. Check if server is already running on target port to prevent port collisions.
3. If not running, launch the dev server as a background daemon process so the user can immediately test locally.
