---
name: code-review
description: Executes an adversarial, clean-context review on recent git diffs using an isolated subagent to detect regressions, slop, and scope creep.
---

# Procedure: Adversarial Code & Diff Review

## 1. Isolation Requirement (Context-Free Subagent)
To eliminate author confirmation bias, the primary agent that wrote the implementation code **must not** perform this review directly within the same conversation thread.

- **Subagent Execution:** Launch an isolated review subagent (e.g., using `invoke_subagent` with the `research` or `self` subagent type).
- **Clean Context:** Pass **only** the git diff (`git diff HEAD~1` or target branch), modified files, and the original spec/task requirements in the prompt. Do not transfer working conversation logs or implementation justifications.

## 2. Review Inputs (Provided to Subagent)
- Git diff of the latest commit / changes (`git diff HEAD~1`).
- Task specification from `specs/[feature-name].md` or the user's initial acceptance criteria.

## 3. Review Protocol
The subagent must adopt an adversarial senior engineer posture. Do not congratulate, summarize features, or generate polite filler; report discrepancies, regressions, and risks only.

1. **Scope Creep Audit:** Did any files change that were not required for this specific task?
2. **Regression & Architectural Check:** Were existing utility signatures modified? Does this create hidden coupling or break other modules?
3. **Test Integrity:**
   - Did the diff include unit/integration tests covering the new behavior?
   - Were any existing tests modified, weakened, or commented out?
4. **Dead Code & Slop Sweep:**
   - Are there unused imports or orphan functions?
   - Are there leftover debug statements (`console.log`, `print`, `debugger`)?
   - Is there commented-out legacy code?
5. **Security & Validation:** Are all new external inputs validated and sanitized?

## 4. Output Format
- **Verdict:** [PASS | PASS WITH RECOMMENDATIONS | FAIL / REWORK REQUIRED]
- **Actionable Issues:** All findings must be organized into two top-level categories. In each item, the ELI5 summary is placed first and the ELI5 remedy/recommendation is placed last so the reviewer can scan First and Last:

### Category 1: Can Be Automatically Resolved
Mechanical, deterministic fixes that do not require architectural or product trade-offs (e.g., removing leftover debug logs, deleting unused imports, formatting, fixing typos, adding straightforward type annotations).
For each item, include:
- **ELI5 Summary:** Simple, plain-English summary of what is wrong and why it matters (FIRST).
- **Location:** `path/to/file#line`
- **Technical Finding:** Concise technical explanation of the issue.
- **Automated Remedy:**
  - **Technical Fix:** Exact automated command, patch, or code adjustment to apply.
  - **ELI5 Remedy:** Plain-English summary of what the fix does in simple terms (LAST).

### Category 2: Needs a Decision
Issues involving architectural trade-offs, scope ambiguity, breaking changes, or subjective product choices requiring human judgment.
For each item, include:
- **ELI5 Summary:** Simple, plain-English explanation of what is wrong and why it requires a decision (FIRST).
- **Location:** `path/to/file#line`
- **Technical Finding:** Technical description of the issue or risk.
- **Recommendations:**
  - **Technical Options:** Concrete technical proposals (Option A, Option B) with recommended default.
  - **ELI5 of Recommendations:** Plain-English summary of the options, what choosing each means in practice, along with pros and cons, free of heavy jargon (LAST).
