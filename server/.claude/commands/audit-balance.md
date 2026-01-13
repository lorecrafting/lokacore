# Balance Audit

Review game balance across combat, economy, and progression systems.

> **Timeout Budget**: 15 minutes (or skip Phase 3 simulations with --quick)

> **Performance Note**: Balance simulations are expensive and may timeout during full audit suite. Consider running this audit separately with `--quick` flag, or run simulations manually after data review.

## Phase 1: Data Review (Fast)

Review data files for obvious balance issues before running simulations.

### A. Combat Data Review
- NPC stat definitions for obvious outliers
- Damage formula consistency across abilities
- Check for level-inappropriate stats (level 1 NPC with level 10 stats)
- Boss stats vs normal NPC comparison
- **NPC field name consistency**: Search for `xp_value` vs `xp_reward` and `gold_value` vs `gold_reward` mismatches. The correct field names are `xp_value` and `gold_value` in YAML prototypes.

### B. Economy Data Review
- Shop price consistency (similar items = similar prices)
- Item value vs tier correlation
- Currency drops vs item costs ratio
- Obvious pricing errors (100g item selling for 10g)

### C. Progression Data Review
- XP values in quest definitions
- Skill requirements vs availability
- Equipment stat scaling by tier
- Quest reward amounts

### D. Item Data Review
- Weapon damage ranges by tier
- Armor defense scaling consistency
- Consumable cost vs effect ratio
- Drop rates in loot tables

## Phase 2: Analysis (Medium)

### E. Formula Analysis
- Combat damage formulas
- XP curve formula
- Stat scaling formulas
- Resource regeneration rates

### F. Quest Design Analysis
- Time-to-complete estimates
- Reward adequacy for effort
- Difficulty vs prerequisites alignment
- Optional vs required content ratio

## Phase 3: Simulations (Optional/Slow)

> **Skip with --quick flag**. Run separately if needed: `mix loka.test.balance`

### G. Simulations
- Run `mix loka.test.balance --quick` for fast check
- Simulate full playthrough progression
- Test edge cases (min/max builds)
- Economy simulation over time

## Deliverables

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Balance issues with specific numbers (data review, bead-ready format)
2. Recommended value adjustments
3. Formulas/curves that need revision
4. Note if balance testing parameters need updates

> **Note**: Check for data ERRORS (wrong values) in this audit. Gameplay feel and "is this fun?" questions are better addressed through playtesting.
