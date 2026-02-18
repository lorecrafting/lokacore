# Room Addition Workflow

Applies when adding 3+ rooms or a new zone.

## Map-First Rule

**Always draw and get approval for a text map BEFORE writing any YAML files.**

```
[room_a] --north--> [room_b] --east--> [room_c]
             |west
         [room_d]
```

Present the map, wait for approval, then implement.

## Directions

**Only use 6 cardinal directions:** `north`, `south`, `east`, `west`, `up`, `down`

Never use: `northwest`, `northeast`, `southeast`, `southwest` — the game engine rejects these.

## Connectivity Rules

1. Every room must be reachable from `awakening_clearing` via cardinal exits
2. Every exit must be bidirectional (A→B means B→A must also exist)
3. No dead-end rooms (rooms with only 1 exit are suspicious — verify intent)

## Implementation Checklist

1. Draw text map → get approval
2. Write YAML files with bidirectional exits
3. Verify connectivity:
   ```bash
   LOKA_CONTENT_VALIDATION=skip mix loka.test.validate --only world
   ```
   Must show 0 `orphan_room` errors.
4. Navigate the new zone via telnet — do NOT skip with `goto`. Walk the actual exits:
   ```bash
   nc localhost 4023
   # then: goto <starting_point>, walk each direction, confirm room names
   ```

## Common Pitfall

If a room is only reachable via a diagonal exit, it becomes orphaned. When replacing a diagonal with a 2-hop cardinal route, ensure the intermediate room has the needed direction free.
