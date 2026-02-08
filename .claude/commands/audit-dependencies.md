# Dependencies Audit

Review project dependencies for security, updates, and optimization.

> **Timeout Budget**: 5 minutes (mostly automated checks)

## Areas to Audit

### A. Security Vulnerabilities
- Run `mix deps.audit` or equivalent
- Check for known CVEs
- Review transitive dependencies
- Evaluate unmaintained packages
- Check for typosquatting risks

### B. Version Currency
- Outdated major versions
- Available minor/patch updates
- Elixir/OTP compatibility
- Phoenix/LiveView updates
- Breaking change assessment

### C. Dependency Health
- Maintenance status (last commit, issues)
- Community support level
- License compatibility
- Alternative package availability
- Bus factor concerns

### D. Bundle Optimization
- Unused dependencies
- Duplicate functionality
- Heavy dependencies for light use
- Dev-only deps in prod
- Optional dependency usage

### E. JavaScript Dependencies
- npm audit results
- Outdated packages
- Bundle size impact
- Tree-shaking opportunities
- CDN vs bundled assets

### F. Upgrade Planning
- Breaking changes to prepare for
- Deprecation warnings to address
- Migration path documentation
- Testing requirements for upgrades

## Deliverables

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Vulnerabilities requiring immediate action (bead-ready format)
2. Recommended updates with migration notes
3. Dependencies to consider replacing
4. Note if mix.exs comments need updates
