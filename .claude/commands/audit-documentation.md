# Documentation Audit

Review documentation accuracy, completeness, and usefulness.

> **Timeout Budget**: 10 minutes (runs last in full audit)

## Areas to Audit

### A. Code Documentation
- Moduledoc coverage and quality
- Function doc coverage for public APIs
- Typespec accuracy and completeness
- Example code correctness
- Deprecated function warnings

### B. Architecture Docs
- Accuracy vs current implementation
- Diagram currency
- Missing architectural decisions
- Cross-reference correctness
- Outdated patterns

### C. Content Creator Docs
- BUILDERS_GUIDE.md completeness
- YAML schema documentation
- Example prototype accuracy
- Common patterns documented
- Troubleshooting guides

### D. API Documentation
- Endpoint documentation accuracy
- Request/response examples
- Error code documentation
- Authentication flow clarity
- Rate limit documentation

### E. Operational Docs
- Deployment procedures accuracy
- Monitoring setup guides
- Backup/restore procedures
- Incident response playbooks
- Environment setup guides

### F. CLAUDE.md & AGENTS.md
- Sync with codebase reality
- Pointers to correct files
- Pattern guidance accuracy
- Quick command references
- Slash command documentation

## Deliverables

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Outdated docs with specific inaccuracies (bead-ready format)
2. Missing documentation topics
3. Broken internal links
4. Note if documentation index needs updates
