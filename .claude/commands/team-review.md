# Team Review

Comprehensive multi-perspective code review from the entire virtual team.

## Usage

```
/team-review [scope]
```

**Scope options:**
- (no args) - Review all uncommitted changes
- `staged` - Review only staged changes
- `path/to/file` - Review specific file or directory
- `--quick` - Skip automated tests, just do perspectives

## Instructions

### Step 1: Gather Context

```bash
# Get change summary
git status --short
git diff --stat HEAD

# If reviewing specific scope, filter accordingly
```

### Step 2: Run Automated Checks (unless --quick)

```bash
# Server tests
cd server && mix test --max-failures 5

# Formatting
cd server && mix format --check-formatted

# Content validation (if YAML changed)
cd server && mix loka.test.validate --quick

# Godot validation (if .gd files changed)
cd godot-client && ./check.sh
```

### Step 3: Multi-Perspective Review

Review the changes from each team member's perspective:

#### 🏗️ Senior Architect
- Layer separation (Engine ← Framework ← Web)
- Component cohesion and coupling
- Scalability implications
- Pattern consistency

#### 👨‍💻 Senior Engineer
- Code quality and readability
- Error handling completeness
- Edge cases covered
- Performance considerations
- Test coverage gaps

#### 🎮 Senior Game Developer
- Gameplay impact
- Game loop integration
- Entity/component patterns
- Client-server sync

#### 🎨 Senior Game Designer
- Player experience impact
- Balance implications
- UX considerations
- Accessibility

#### 🛠️ Senior Game Tools Engineer
- World Builder functionality
- Admin tooling
- Developer experience
- Debug capabilities

#### 🎯 Senior Game Tools Designer
- UI/UX for internal tools
- Workflow efficiency
- Error prevention
- Help/documentation

#### 📊 Producer
- Risk assessment (Low/Medium/High/Critical)
- Ship readiness percentage
- Blocking issues
- Timeline impact

#### 💼 CEO
- Business impact
- Strategic alignment
- Resource efficiency
- Technical debt status

#### 📢 Marketing
- User-facing changes
- Announcement potential
- Competitive advantage

#### 🔍 Senior QA Specialist
- Test coverage analysis
- Manual testing requirements
- Regression risks
- Edge cases to verify

### Step 4: Generate Report

## Output Format

```markdown
# Team Review Report

## Executive Summary
[2-3 sentence overview]

## Changes Overview
[Bullet list of major changes]

---

## 🏗️ Senior Architect
### Strengths
- [Point]
### Concerns
- [Point]
### Verdict: ✅|⚠️|❌ [One line]

## 👨‍💻 Senior Engineer
### Strengths
- [Point]
### Concerns
- [Point]
### Missing
- [ ] [Checklist item]
### Verdict: ✅|⚠️|❌ [One line]

## 🎮 Senior Game Developer
[Same format]

## 🎨 Senior Game Designer
[Same format]

## 🛠️ Senior Game Tools Engineer
[Same format]

## 🎯 Senior Game Tools Designer
[Same format]

## 📊 Producer
### Risk Assessment
| Area | Risk | Mitigation |
|------|------|------------|
| [Area] | [Low/Med/High/Critical] | [How to mitigate] |

### Ship Readiness: X% - [Reason]

## 💼 CEO
### Business Impact
[Points]
### Verdict: ✅|⚠️|❌

## 📢 Marketing
### Observations
[Points or N/A]

## 🔍 Senior QA Specialist
### Test Coverage
| Component | Status |
|-----------|--------|
| [Name] | ✅|⚠️|❌ [Notes] |

### Required Before Merge
1. [Action item]

---

## Overall Recommendation

| Aspect | Status |
|--------|--------|
| Architecture | ✅|⚠️|❌ |
| Code Quality | ✅|⚠️|❌ |
| Security | ✅|⚠️|❌ |
| Performance | ✅|⚠️|❌ |
| Testing | ✅|⚠️|❌ |
| Documentation | ✅|⚠️|❌ |

### Before Commit
1. [Critical action]
2. [Action]

### After Merge
1. [Follow-up item]
```

## Success Criteria

- All perspectives addressed
- Clear actionable recommendations
- Blocking issues identified
- Risk level assessed

## When to Use

- Before creating PRs
- After completing a feature
- Before major deploys
- When user asks to "check work", "review changes", "verify", etc.

## Related Commands

- `/pre-pr-full-verification` - Automated tests only
- `/review-architecture` - Deep architecture dive
- `/test-and-fix` - Fix failing tests
