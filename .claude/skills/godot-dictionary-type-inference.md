# Godot Dictionary Type Inference

## Trigger
- Godot parse error: "Cannot infer the type of variable because the value doesn't have a set type"
- Error occurs when using dictionary values in arithmetic/string expressions
- Common with `stats["key"]` or similar dictionary access patterns

## Problem

GDScript's type inference (`:=`) cannot determine types when dictionary values are used in expressions, because dictionaries store `Variant` values:

```gdscript
# ❌ FAILS - Cannot infer type
var stats: Dictionary = {"con": 10, "int": 15}
var hp := 50 + (stats["con"] * 4)  # Parse error!
```

## Solution

Extract dictionary values to typed local variables first:

```gdscript
# ✅ CORRECT - Explicit type annotation
var stats: Dictionary = {"con": 10, "int": 15}
var con_val: int = stats["con"]
var hp: int = 50 + (con_val * 4)
```

## Alternative Solutions

```gdscript
# Option 1: Explicit type on the result variable
var hp: int = 50 + (stats["con"] * 4)

# Option 2: Cast the dictionary value
var hp := 50 + (int(stats["con"]) * 4)

# Option 3: Use typed dictionary (Godot 4.x)
var stats: Dictionary[String, int] = {"con": 10}
var hp := 50 + (stats["con"] * 4)  # Works!
```

## When This Occurs

- Stat calculations using player/NPC attribute dictionaries
- Derived stat formulas (HP from CON, Mana from INT, etc.)
- Any arithmetic with dictionary-stored numeric values
- String concatenation with dictionary values

## Related Files

- `godot-client/scripts/character_creation.gd` - Fixed in lines 318-324

## Verification

Run `./check.sh` to catch these errors headlessly before testing in editor.
