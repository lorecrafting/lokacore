# check-balance

Quick balance verification after content or combat system changes.

## Purpose

Run balance checks to ensure NPCs, rewards, and progression are properly tuned.

## Instructions

Execute balance analysis after changes to:
- NPC stats (health, damage, armor)
- Combat mechanics
- Quest rewards
- Item stats
- Progression curves

### 1. Determine Scope

**If content changed** (NPCs, quests, items):
```bash
cd server && mix loka.test.balance --quick
```

**If combat system changed**:
```bash
cd server && mix loka.test.balance --thorough
```

**If only checking specific content**:
Use the Balance Analyzer API directly with specific world/quest specs.

### 2. Review Balance Report

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

### 3. Flag Critical Issues Only

Focus on issues that:
- Break game balance (too easy/hard to progress)
- Create dead ends (impossible encounters)
- Make content unrewarding (effort >> reward)

Ignore minor issues (<5% off target) unless systematic.

### 4. Simulation Results

Review combat simulations:
- **Win rate target**: 70% (range: 60-80%)
- **Turns target**: 4 (range: 2-6)
- **Sample size**: 100 (quick) or 1000 (thorough)

### 5. Quick Fix Suggestions

For critical issues, suggest:
- NPC stat adjustments (±10-20% health/damage)
- Reward multipliers
- Quest difficulty tier changes

## Output Format

```markdown
# Balance Check Report

## Overall Score: X/10

## ⚠️ Critical Issues (Requires Immediate Fix)

### 1. [NPC/Quest Name]
**Issue**: Win rate 45% (target: 70%)
**Location**: priv/world/prototypes/npcs/[file]
**Suggested Fix**: Reduce NPC health by 20% (50 → 40)

## 🔧 High Priority (Should Fix Soon)

### 1. [Issue]
...

## 📊 Simulation Stats
- Total simulations: N
- NPCs analyzed: X
- Quests analyzed: Y
- Average balance score: Z/10

## ✅ Well-Balanced Content
- [List NPCs/quests with good balance scores]

## Summary
Status: ✅ BALANCED | ⚠️ NEEDS TUNING | ❌ CRITICAL ISSUES

Next Steps:
1. [Specific action items]
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
