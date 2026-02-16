# Phase 0: Preparation

> Full spec: `docs/architecture/unified-object-system-v2.md` Section 37 (Steps 0.1-0.5) + Section 19 (YAML transforms)

## Task 0.1: Archive V1 + Create Working Branch

```bash
git checkout main
git checkout -b archive/v1-final
git push origin archive/v1-final
git checkout main
git checkout -b v2/unified-entity-system
```

## Task 0.2: Record Test Baseline

```bash
cd server
mix test --trace 2>&1 | tee ../v1-test-baseline.txt
mix loka.test.validate 2>&1 | tee ../v1-validation-baseline.txt
echo "Tests: $(grep -c 'test ' ../v1-test-baseline.txt) | Failures: $(grep -c 'failure' ../v1-test-baseline.txt)"
```

## Task 0.3: Write YAML Conversion Task

Create `lib/mix/tasks/loka.convert_yaml.ex`. The task:

1. Reads each YAML file in `priv/world/`
2. Maps V1 fields to V2 structure
3. Applies script code transformations (23 renames)
4. Flags scripts using removed bindings (13 bindings)
5. Writes converted file back
6. Outputs summary of changes

### YAML Structure Transforms

- Quest top-level fields → `components.quest` (name→short_desc, description→long_desc, objectives/rewards/giver→components.quest.*)
- Dialogue trees → `components.dialogue_tree`
- `parent:` → `parent_key:` consistently
- Room `exits:` → mark for seeder extraction (or create separate exit YAML files)
- Room `spawns:` → `components.room.spawns`
- Add explicit `type:` to any files missing it
- Ensure `scripts:` use flat `event_name: code_string` format

### Script Rename Table (23 entries — mechanical text replacement)

| V1 | V2 |
|----|-----|
| `entity` (context var) | `self()` |
| `player` / `player()` | `event().speaker` or `event().user` |
| `room()` | `get_location(self())` |
| `has_item?(key)` | `has_item?(event().speaker, key)` |
| `quest_active?(id)` | `quest_active?(event().speaker, id)` |
| `quest_complete?(id)` | `quest_complete?(event().speaker, id)` |
| `get_stat(name)` | `get_component(self(), "stats", name)` |
| `give_item(key)` | `spawn_entity(key, location: event().speaker)` |
| `remove_item(key)` | `despawn(find_by_keyword(key, :item))` |
| `start_quest(id)` | `grant_quest(event().speaker, id)` |
| `spawn_at(key, loc)` | `spawn_entity(key, location: loc)` |
| `spawn_npc(key)` | `spawn_entity(key, location: self().location_id)` |
| `spawn_item(key)` | `spawn_entity(key, location: self().location_id)` |
| `damage(target, amt)` | `apply_damage(target, amt)` |
| `apply_effect(t, k)` | `apply_status(t, k)` |
| `remove_effect(t, k)` | `remove_status(t, k)` |
| `announce_room(text)` | `broadcast(get_location(self()), text)` |
| `after(sec, event)` | `set_timer(name, sec, event)` |
| `pick(list)` | `pick_random(list)` |
| `send_to(t, n, p)` | `emit(t, n, p)` |
| `count(list)` | `length(list)` |
| `get_behavior_state(k)` | `get_state(k)` |
| `set_behavior_state(k, v)` | `set_state(k, v)` |

### Removed V1 Bindings (13 — flag for manual review, don't auto-convert)

`context`, `config`, `quest_objective_done?`, `get_skill`, `get_attribute`, `entity_present?`, `find_entities_by_tag`, `current_weather`, `is_outdoor?`, `is_dark?`, `create_room`, `default`, `allow`

### Unchanged Bindings (~32 — no conversion needed)

`say`, `emote`, `message`, `has_flag?`, `get_flag`, `set_flag`, `complete_objective`, `despawn`, `move_entity`, `teleport`, `heal`, `set_room_attr`, `lock_exit`, `unlock_exit`, `set_cooldown`, `on_cooldown?`, `cooldown_remaining`, `emit`, `entities_in_room`, `players_in_room`, `time_of_day`, `current_hour`, `chance?`, `roll`, `random`, `contains?`, `downcase`, `upcase`, `any?`, `all?`, `find` (list), `first`, `last`, `log`, `deny`, `handled`, `continue`

### Implementation Notes

- Use `YamlElixir` to parse, manipulate as maps, write back with `yaml_elixir`
- Script code transforms are regex replacements on code strings within `scripts:` blocks
- `--dry-run` flag should show changes without writing
- Log every file and whether it was auto-converted or needs manual review
- Target: >90% auto-converted, <10% manual fixup

## Task 0.4: Run Conversion + Commit

```bash
mix loka.convert_yaml
mix loka.test.validate   # verify content still valid
git add priv/world/
git commit -m "chore(v2): convert YAML to V2 format (one-time migration)"

# Then delete the task
rm lib/mix/tasks/loka.convert_yaml.ex
git add -A && git commit -m "chore(v2): remove one-time YAML conversion task"
```

## Dependency Audit (informational — no action needed)

All V1 deps are still needed in V2: `ecto_sqlite3`, `jason`, `yaml_elixir`, `guardian`, `phoenix_pubsub`, `req`, `phoenix_live_view`. No new deps needed.
