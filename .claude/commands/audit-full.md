# Full Audit Suite

Run the complete Loka audit suite by spawning parallel agents for each audit category, then perform a meta-audit to improve the audit system itself.

> **Important**: This audit produces a **report only**. No beads are created automatically. After reviewing the report, prompt "create beads from audit" to generate issues for items you want to track.

## Instructions

Launch parallel agents for each audit domain. Use the Task tool with subagent_type="general-purpose" for each audit.

## Timeout Budgets

Each audit has a recommended time limit. If an audit exceeds its budget, return partial results.

| Audit | Timeout | Notes |
|-------|---------|-------|
| Content | 10 min | Includes running validators |
| Architecture | 10 min | Large codebase scan |
| Layer | 8 min | Engine/Framework/WorldData separation |
| Security | 8 min | Critical - don't skip |
| Performance | 8 min | May sample for large codebases |
| UX | 8 min | |
| Balance | 15 min | Or skip Phase 3 simulations with --quick |
| Testing | 8 min | |
| Narrative | 8 min | |
| Dependencies | 5 min | Mostly automated checks |
| Accessibility | 8 min | |
| Scalability | 8 min | |
| Observability | 8 min | |
| Documentation | 10 min | Runs last |

## Phase 1: Run 13 Audits in Parallel

Spawn agents for the following audits simultaneously (all except Documentation):

1. **Content Audit** - Read `.claude/commands/audit-content.md` and execute
2. **Architecture Audit** - Read `.claude/commands/audit-architecture.md` and execute
3. **Layer Audit** - Read `.claude/commands/audit-layer.md` and execute (Engine/Framework/WorldData separation)
4. **Security Audit** - Read `.claude/commands/audit-security.md` and execute
5. **Performance Audit** - Read `.claude/commands/audit-performance.md` and execute
6. **UX Audit** - Read `.claude/commands/audit-ux.md` and execute
7. **Balance Audit** - Read `.claude/commands/audit-balance.md` and execute
8. **Testing Audit** - Read `.claude/commands/audit-testing.md` and execute
9. **Narrative Audit** - Read `.claude/commands/audit-narrative.md` and execute
10. **Dependencies Audit** - Read `.claude/commands/audit-dependencies.md` and execute
11. **Accessibility Audit** - Read `.claude/commands/audit-accessibility.md` and execute
12. **Scalability Audit** - Read `.claude/commands/audit-scalability.md` and execute
13. **Observability Audit** - Read `.claude/commands/audit-observability.md` and execute

## Phase 1.5: Run Documentation Audit LAST

After all Phase 1 audits complete, run the Documentation Audit:

14. **Documentation Audit** - Read `.claude/commands/audit-documentation.md` and execute

This runs last because:
- Documentation should reflect the current state of the codebase
- Other audits may fix issues that would otherwise show as doc inconsistencies
- Changes from other audits should be documented accurately

## Agent Prompt Template

For each agent, use this prompt pattern:

```
Read the audit instructions from [audit file path] and execute them fully.

**Verification Rules**:
- Use Read tool to verify file existence before flagging as missing
- Run example code to verify documentation accuracy where possible
- Check both project root and server/ subdirectory for project-level files

**Timeout Handling**:
- If audit cannot complete in reasonable time, return partial results
- Clearly note what was completed and what was skipped
- For expensive operations (simulations, full scans), consider sampling

Report back with:
1. Summary of findings (bullet points)
2. Issues found ranked by severity (Critical/High/Medium/Low)
3. Recommended follow-up actions (DO NOT create beads - report only)
4. **Audit Completion Status**: Full | Partial (note what was skipped) | Failed

Focus on RESEARCH and REPORTING only. Do not make code changes. Do not create beads. Flag all changes for user review.
```

## Phase 2: Consolidate Findings

Once all agents report back, consolidate into a unified report:

### Agent Completion Verification

Before consolidating, verify each agent's status:
- Did each agent complete successfully?
- Any timeouts or errors?
- Flag audits with partial results for manual follow-up

### Codebase Health Report

Group findings by priority:
- **Critical** - Requires immediate attention (security vulnerabilities, data loss risks, game-breaking bugs)
- **High** - Should address soon (broken functionality, major UX issues, architectural debt)
- **Medium** - Good to fix (code quality, minor inconsistencies, missing tests)
- **Low** - Nice to have (optimizations, polish, documentation)

### Summary Statistics
- Issues found per audit category
- Overall codebase health score (1-10)
- Top 5 most impactful issues to address

## Phase 3: Meta-Audit (Audit Improvement Loop)

After consolidating findings, spawn ONE MORE agent to perform the meta-audit:

```
Read `.claude/commands/audit-meta.md` and execute it fully.

Context from this audit run:
- [Paste summary of which audits found issues and which didn't]
- [Note any issues found that existing checklists should have caught but didn't]

Report your findings as SUGGESTIONS ONLY. Do NOT modify any audit files or create beads.
```

See `audit-meta.md` for the full meta-audit methodology.

## Phase 4: Final Report

Present to user:

### Part A: Codebase Audit Results
- Consolidated findings from all 14 audits
- Issues organized by severity (Critical/High/Medium/Low)
- No beads created - awaiting user direction

### Part B: Audit System Improvements
- Meta-audit suggestions organized by category
- Clearly marked as "suggestions for review"
- No changes made - awaiting user direction

### Part C: Next Steps

Inform user they can:
- "Create beads for critical issues" → Create beads for Critical/High severity items
- "Create beads for all issues" → Create beads for everything found
- "Create bead for [specific issue]" → Create bead for one item
- "Implement audit improvements" → Apply approved meta-audit suggestions
- "Skip beads, just note the findings" → End without creating beads

## Subset Audits

To run only specific audits, tell me which categories you want:
- "Run content and architecture audits only"
- "Run security and dependencies audits"
- etc.

Add `--skip-meta` to skip the meta-audit phase.
Add `--quick` to skip expensive operations (balance simulations, full E2E runs).

## Notes

- Full suite may take 10-15 minutes depending on codebase size
- Each agent runs independently and reports findings
- Conflicts between agent recommendations will be flagged for human review
- Resource-intensive audits (balance simulations, full E2E) can be skipped with `--quick` flag
- Meta-audit suggestions are NEVER auto-implemented - always require explicit user approval
- Balance audit may timeout due to expensive simulations - consider running separately

## Audit Maintenance

After every 3-5 full audit runs:
1. Review meta-audit suggestions and implement valuable ones
2. Update checklists based on findings (add items that caught real issues)
3. Remove checklist items that never find issues
4. Adjust severity guidelines if misclassifications are common
