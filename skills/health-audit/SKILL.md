---
name: health-audit
description: Audits repository test coverage reality, dependency vulnerabilities, and orphan/dead files.
---

# Procedure: Repository Health & Test Coverage Audit

## Health Checklist
1. **Test Suite Reality Check:**
   - How many test files and total assertions exist?
   - Identify critical application paths that have ZERO test coverage.
   - Check for tests without assertions or tests passing via broad try/catch swallows.
2. **Dependency & Security Vulnerability Check:**
   - Run the ecosystem audit command (e.g., `npm audit`, `pip-audit`, `cargo audit`).
   - Flag any High or Critical vulnerabilities.
3. **Dead Code & Orphan Check:**
   - Scan for files in `src/` or `lib/` that are never imported anywhere in the project.
   - Check for unused export warnings via linter.
4. **Git Hygiene:**
   - Report uncommitted changes, untracked artifacts, or improperly ignored temporary files (`.env`, debug logs, local caches).

## Output Format
- **Health Summary Matrix:** Test count, assertion count, known vulnerabilities, and orphan files.
- **Findings & Remediation Tasks:** All findings and tasks must be organized into two top-level categories. In each item, the ELI5 summary is placed first and the ELI5 remedy/recommendation is placed last so the reviewer can scan First and Last:

### Category 1: Can Be Automatically Resolved
Mechanical maintenance tasks that can be safely automated without product trade-offs (e.g., automated vulnerability fixes like non-breaking dependency patches, pruning proven dead/orphan files, cleaning untracked build artifacts, removing unused exports).
For each item, include:
- **ELI5 Summary:** Simple, plain-English summary of what is wrong and why it matters (FIRST).
- **Scope / Target:** Affected files, exports, or dependencies.
- **Technical Finding:** Technical description of the issue.
- **Automated Remedy:**
  - **Technical Fix:** Exact automated command or cleanup script to apply.
  - **ELI5 Remedy:** Plain-English summary of what the fix does in simple terms (LAST).

### Category 2: Needs a Decision
Issues involving architectural trade-offs, breaking major dependency upgrades, test coverage strategy for legacy modules, or risk tolerance choices requiring human judgment.
For each item, include:
- **ELI5 Summary:** Simple, plain-English summary of what is wrong and why it requires a decision (FIRST).
- **Scope / Target:** Affected component, module, or dependency.
- **Technical Finding:** Technical description of the risk or deficit.
- **Recommendations:**
  - **Technical Options:** Concrete technical proposals (Option A, Option B) with recommended default.
  - **ELI5 of Recommendations:** Plain-English summary of the options, what choosing each means in practice, along with pros and cons, free of heavy jargon (LAST).

- **Top 3 High-Priority Health Tasks:** Actionable remediation items recommended for the next work session selected from the categories above.
