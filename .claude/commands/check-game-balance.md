# Check Game Balance

Run balance verification after content or combat system changes.

## Usage

```
/check-game-balance [--quick] [--combat-only] [--progression-only]
```

## Instructions

### Step 1: Determine Scope

**Quick check** (100 iterations):
```bash
cd server && mix loka.test.balance --quick
```

**Full check** (1000 iterations - default):
```bash
cd server && mix loka.test.balance
```

**Extended check** (custom iterations):
```bash
cd server && mix loka.test.balance --iterations 5000
```

**Combat only**:
```bash
cd server && mix loka.test.balance --combat-only
```

**Progression only**:
```bash
cd server && mix loka.test.balance --progression-only
```

### Step 2: Review Balance Report

Parse the output for:

#### Combat Balance Issues
- **Critical**: Win rate <60% or >80% (fight is too hard or too easy)
- **High**: Average turns >6 (fight drags on too long)
- **Medium**: Reward not matching difficulty

#### Reward Balance Issues
- **Critical**: XP/gold significantly off curve
- **High**: Quest rewards don't match effort
- **Medium**: Minor tuning needed

#### Progression Issues
- **Critical**: Level gaps in content (1→5→20)
- **High**: Difficulty spikes between quests
- **Medium**: Uneven progression curve

### Step 3: Simulation Results

Review combat simulations:
- **Win rate target**: 70% (range: 60-80%)
- **Turns target**: 4 (range: 2-6)
- **Sample size**: 100 (quick) or 1000 (thorough)

### Step 4: Suggest Fixes

For critical issues, suggest:
- NPC stat adjustments (±10-20% health/damage)
- Reward multipliers
- Quest difficulty tier changes

## Output Format

```markdown
# Balance Check Report

## Overall Score: X/10

## Critical Issues (Requires Immediate Fix)

### 1. [NPC/Quest Name]
**Issue**: Win rate 45% (target: 70%)
**Location**: priv/world/prototypes/npcs/[file]
**Suggested Fix**: Reduce NPC health by 20% (50 → 40)

## High Priority
[List issues]

## Simulation Stats
- Total simulations: N
- NPCs analyzed: X
- Quests analyzed: Y
- Average balance score: Z/10

## Well-Balanced Content
[List NPCs/quests with good balance scores]

## Summary
Status: ✅ BALANCED | ⚠️ NEEDS TUNING | ❌ CRITICAL ISSUES
```

## Success Criteria

- Overall balance score >= 6.0
- No critical issues (all encounters winnable with proper tactics)
- Progression curve is smooth (no sudden spikes)
- Rewards match effort

## When to Run

- After adding/modifying NPCs
- After changing combat formulas
- After adjusting quest rewards
- Before releasing new content
- After player feedback about difficulty

## Notes

- Quick mode (100 iterations) is usually sufficient
- Thorough mode (1000+ iterations) for final verification
- Balance is subjective - use player feedback too
- Some variance is good (easy and hard encounters)
- Target 70% win rate assumes optimal play, not average player
