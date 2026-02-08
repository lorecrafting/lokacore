# Meta-Audit: Audit System Improvement

Analyze and improve the audit system itself. This creates an improvement loop by auditing the audit prompts, identifying gaps, and suggesting enhancements.

> **Important**: This audit produces a **report only**. No beads are created automatically. After reviewing the report, prompt "create beads from meta-audit" to generate issues for approved improvements.

## When to Run

- When audits consistently miss issues that are later discovered
- When starting a new development phase (new features may need new audit coverage)
- When onboarding new team members (ensure audits cover their concerns)

## Phase 1: Audit File Analysis

Read ALL audit files in `.claude/commands/audit-*.md` and analyze each for:

### A. Clarity & Actionability

For each audit file, evaluate:

| Criteria | Score (1-5) | Notes |
|----------|-------------|-------|
| Clear scope definition | | Does it say what's IN and OUT of scope? |
| Actionable checklist items | | Can each item be verified objectively? |
| Specific file/path guidance | | Does it tell you WHERE to look? |
| Expected output format | | Clear deliverables section? |
| Timeout budget realistic | | Based on actual execution times? |
| Verification commands included | | Bash commands to check findings? |

### B. Checklist Quality

For each checklist item in each audit:
- **Specific enough?** - Can you verify it without interpretation?
- **Measurable?** - Can you say definitively pass/fail?
- **Relevant?** - Does it catch real issues in this codebase?
- **Up-to-date?** - Does it reflect current architecture?

Flag items that are:
- Too vague: "Check for issues" → Should be "Check X module for Y pattern"
- Outdated: References removed/renamed modules or patterns
- Unrealistic: Would take hours to properly verify
- Redundant: Same check exists in another audit

### C. Cross-Audit Consistency

Check all audits for:
- **Terminology consistency** - Same concepts use same names
- **Severity scale consistency** - Critical/High/Medium/Low used the same way
- **Output format consistency** - Similar reporting structure
- **Scope boundaries** - Clear delineation, minimal overlap

## Phase 2: Coverage Analysis

### A. Architecture Coverage Map

Create a matrix of what each audit covers:

| Area | Content | Arch | Layer | Security | Perf | UX | ... |
|------|---------|------|-------|----------|------|-----|-----|
| Engine | | ✓ | ✓ | | ✓ | | |
| Framework | | ✓ | ✓ | | ✓ | | |
| LiveView | | ✓ | | | ✓ | ✓ | |
| Prototypes | ✓ | ✓ | | | | | |
| Database | | | | ✓ | ✓ | | |
| ... | | | | | | | |

Identify gaps - areas with no or minimal coverage.

### B. Issue Type Coverage

Based on issues found in recent sessions (check beads, git history, CLAUDE.md notes):

| Issue Type | Which Audit Catches? | Actually Caught? |
|------------|---------------------|------------------|
| Nil pointer errors | Testing? | |
| UI/data mismatch | Content | |
| Performance regression | Performance | |
| Auth bypass | Security | |
| ... | | |

Flag issue types that:
- Have no audit coverage
- Have coverage but audits didn't catch them
- Are Loka-specific and not represented

### C. Missing Audit Categories

Consider if new audits are needed for:
- **Internationalization** - Text hardcoding, locale handling
- **Data Migration** - Schema changes, backward compatibility
- **API Stability** - Breaking changes, versioning
- **Error Handling** - User-facing errors, recovery flows
- **State Management** - LiveView assigns, socket state
- **[Loka-specific]** - Entity lifecycle, hook coverage, prototype inheritance

## Phase 3: Effectiveness Review

### A. Historical Effectiveness

For each audit, assess based on actual usage:

| Audit | Issues Found (recent) | False Positives | Missed Issues | Verdict |
|-------|----------------------|-----------------|---------------|---------|
| Content | 5 | 1 | 2 | Effective |
| Architecture | 2 | 0 | 0 | Good |
| Security | 0 | 0 | ? | Needs verification |
| ... | | | | |

Verdicts:
- **Effective**: Finds real issues, few false positives
- **Good**: Works but could be improved
- **Needs work**: Too many false positives or missed issues
- **Obsolete**: Rarely finds anything useful

### B. Agent Execution Analysis

Review how agents execute these audits:
- Do they follow the structure or skip sections?
- Are timeout budgets respected?
- What sections get partial completion?
- Are verification commands actually run?

## Phase 4: Improvement Recommendations

### A. Specific Additions

Format:
```
[audit-name.md] Line ~XX
ADD: "[New checklist item]"
REASON: [Why this is needed]
EVIDENCE: [Issue that would have been caught]
```

### B. Specific Removals

Format:
```
[audit-name.md] Line ~XX
REMOVE: "[Current checklist item]"
REASON: [Why this is no longer useful]
REPLACEMENT: [Alternative coverage, if any]
```

### C. Clarifications

Format:
```
[audit-name.md] Line ~XX
CURRENT: "[Vague text]"
CLARIFY TO: "[Specific, actionable text]"
```

### D. Structural Changes

Format:
```
SUGGESTION: [Merge/Split/Rename/Reorder]
AFFECTED: [audit-a.md, audit-b.md]
RATIONALE: [Why this improves the system]
```

### E. Process Changes

Format:
```
SUGGESTION: [Change to audit workflow]
CURRENT: [How it works now]
PROPOSED: [How it should work]
BENEFIT: [What improves]
```

## Phase 5: Report Generation

Generate a comprehensive report with these sections:

### Meta-Audit Report

#### Executive Summary
- Overall audit system health (1-10)
- Top 3 most effective audits
- Top 3 audits needing improvement
- Critical gaps identified

#### Coverage Analysis
- Architecture coverage matrix
- Issue type coverage table
- Recommended new audit categories

#### Audit-by-Audit Assessment
For each audit file:
- Clarity score (1-5)
- Effectiveness verdict
- Top improvement suggestion

#### Prioritized Improvements
Rank all suggestions by impact:

**High Impact** (would catch significant issues):
1. [Suggestion]
2. [Suggestion]

**Medium Impact** (improves consistency/clarity):
1. [Suggestion]
2. [Suggestion]

**Low Impact** (polish/maintenance):
1. [Suggestion]
2. [Suggestion]

#### Recommended Actions
- Immediate: [Changes to make now]
- Next audit run: [Things to try]
- Long-term: [Structural improvements]

---

## After the Report

**DO NOT** automatically create beads or modify files.

Present the report and wait for user direction. User may say:
- "Create beads for the high-impact improvements" → Create beads for those items
- "Implement suggestion X" → Make that specific change
- "Create beads for all improvements" → Create beads for everything
- "Skip for now" → End without changes

When creating beads, ensure each bead has:
- Specific file paths
- Line numbers or code patterns
- Current vs expected state
- Validation command

## Integration with Full Audit

When running `/audit-full`:
- Meta-audit runs as Phase 3 (after all domain audits)
- Uses findings from domain audits to assess effectiveness
- Still produces report-only output
- User decides which improvements to implement

To skip meta-audit in full run: `/audit-full --skip-meta`
