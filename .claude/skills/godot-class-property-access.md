# GDScript Class Property Access

## Problem
When accessing properties on custom GDScript class instances, using `.get("property")` may not work reliably, causing silent failures where values appear as `null` or empty strings.

## Trigger Conditions
Use this skill when:
- Working with custom GDScript classes (like `MockWorld.NPC`, `MockWorld.Item`, `MockWorld.Room`)
- Code uses `.get("property_name")` on class objects
- Values that should exist are coming back as `null` or empty
- BBCode/URL meta tags aren't being generated for clickable elements

## Root Cause
GDScript's `Object.get()` method behaves differently on class instances than on Dictionaries:
- On **Dictionary**: `.get("key")` reliably returns the value
- On **Class instance**: `.get("property")` may return `null` even if the property exists

## Solution

### Wrong (unreliable on class objects)
```gdscript
# DON'T: Use .get() on class instances
var keyword: String = npc.get("primary_keyword") if npc.get("primary_keyword") else ""
var npc_key: String = npc.get("key") if npc.get("key") else ""
```

### Right (direct property access)
```gdscript
# DO: Use direct property access
var keyword: String = npc.primary_keyword if npc.primary_keyword else ""
var npc_key: String = npc.key if npc.key else ""
```

## When .get() IS Appropriate
- On **Dictionaries** (e.g., server response data, JSON parsed data)
- When you need a default value: `dict.get("key", default_value)`
- When checking if a key exists in a Dictionary

## Code Locations Affected
- `book_page.gd` - Entity rendering (`_render_room_to_page`)
- `book_page.gd` - Entity selection (`_select_npc_by_key`, `_select_item_by_key`)
- Any code iterating over `room.npcs`, `room.items`, or similar arrays of class instances

## Verification
After fixing, clickable elements (underlined keywords) should appear in room text for NPCs and items that have:
- `primary_keyword` set in their prototype
- `key` set (prototype key)
- The keyword appearing in their `long_desc`
