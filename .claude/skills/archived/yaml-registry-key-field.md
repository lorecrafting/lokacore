---
name: yaml-registry-key-field
description: |
  Fix for YAML content failing to load into registries silently. Use when: (1) skills/content
  defined in YAML but not appearing in registry, (2) BinarySkillRegistry.get() returns
  {:error, :not_found} for skills that exist in YAML, (3) from_map() returns
  {:error, {:missing_field, :key}}. Root cause: YAML content nested under a map key
  (like "kick:") doesn't automatically populate the "key" field in the struct.
author: Claude Code
version: 1.0.0
date: 2026-01-29
---

# YAML Registry Key Field Requirement

## Problem

When defining content in YAML files for registries (skills, words, items), the content
may silently fail to load if the `key:` field is missing. This is non-obvious because
the YAML structure uses the key as the map key, but the struct requires an explicit field.

## Context / Trigger Conditions

- Skills/content defined in YAML under `priv/world/skills/*.yml`
- Registry (BinarySkillRegistry, etc.) returns `{:error, :not_found}` for items you defined
- `from_map()` returns `{:error, {:missing_field, :key}}`
- Content appears to exist in YAML but isn't accessible via registry

## Root Cause

YAML files nest content under map keys:

```yaml
skills:
  kick:           # <-- This is the MAP KEY, not a field
    name: Kick
    category: combat_melee
    cost: 1
```

The registry's `from_map/1` function expects an explicit `key:` field in the data:

```elixir
def from_map(data) when is_map(data) do
  with {:ok, key} <- require_field(data, :key),  # <-- Requires explicit key field
       {:ok, name} <- require_field(data, :name) do
    ...
  end
end
```

## Solution

Always include an explicit `key:` field that matches the map key:

```yaml
# ✅ CORRECT - explicit key field
skills:
  kick:
    key: kick        # <-- Must match the map key above
    name: Kick
    category: combat_melee
    cost: 1

# ❌ WRONG - missing key field
skills:
  kick:
    name: Kick       # Will fail: {:error, {:missing_field, :key}}
    category: combat_melee
    cost: 1
```

## Why This Happens

The registry loader iterates over the YAML map but passes only the value to `from_map()`:

```elixir
# In registry loader
Enum.map(yaml_data["skills"], fn {_key, skill_data} ->
  ItemModule.from_map(skill_data)  # skill_data doesn't include the map key!
end)
```

The map key is lost during iteration, so the struct needs it explicitly.

## Verification

After adding `key:` fields, verify loading:

```elixir
# In IEx
iex> BinarySkillRegistry.get("kick")
{:ok, %BinarySkill{key: "kick", name: "Kick", ...}}

# Before fix
iex> BinarySkillRegistry.get("kick")
{:error, :not_found}
```

## Files Affected

- `priv/world/skills/*.yml` - Skill definitions
- `priv/world/magic/words.yml` - Custom magic words (if using registry)
- Any YAML content loaded via `RegistryBase` pattern

## Alternative Fix (Registry-side)

Could modify registry loader to inject the map key:

```elixir
Enum.map(yaml_data["skills"], fn {key, skill_data} ->
  ItemModule.from_map(Map.put(skill_data, "key", key))  # Inject key from map
end)
```

But explicit `key:` fields are clearer and more self-documenting.

## Notes

- This pattern applies to ALL registries using `RegistryBase`
- The error is silent (item just doesn't appear) unless you check return values
- Always verify new YAML content loads by testing registry access
