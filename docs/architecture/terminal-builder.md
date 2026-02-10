# Terminal Builder Architecture

The terminal builder is Loka's content creation tool. It uses a MUD-style command interface running over Phoenix Channels, replacing the previous GUI-based World Builder LiveView.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Browser                                              │
│  MudTerminal hook (WebSocket via Phoenix Channel)    │
│  terminalMarkup.js (clickable command rendering)     │
└───────────────────────┬─────────────────────────────┘
                        │ channel.push("command", {input})
┌───────────────────────▼─────────────────────────────┐
│ GameChannel                                          │
│  handle_in("command") → CommandParser.parse/1        │
│  → {:builder_*, params} → execute_builder_command/3  │
│  → checks player.is_admin                            │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│ BuilderCommands.execute/3 (dispatcher)               │
│  Routes to 16 sub-modules by command category        │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│ Backend Managers                                     │
│  RoomManager, EntityManager, QuestManager, etc.      │
│  → Read/write YAML in priv/world/                    │
│  → TypedObject.Loader.reload() after mutations       │
└─────────────────────────────────────────────────────┘
```

## Command Reference

### Navigation
| Command | Description |
|---------|-------------|
| `goto <room_key>` | Teleport to room |
| `rooms` | List all rooms |
| `where` | Show current location |

### Room Building
| Command | Description |
|---------|-------------|
| `dig <direction> <room_key>` | Create room and link |
| `create room <key>` | Create unlinked room |
| `delete room <key>` | Delete room |
| `link <dir> <target>` | Link current room to target |
| `unlink <direction>` | Remove exit |
| `@name <text>` | Set room name |
| `@desc <text>` | Set room description |

### Entities
| Command | Description |
|---------|-------------|
| `create npc <key> <name>` | Create NPC prototype |
| `create item <key> <name>` | Create item prototype |
| `edit npc <key> <field> <value>` | Edit NPC field |
| `edit item <key> <field> <value>` | Edit item field |
| `delete npc <key>` | Delete NPC |
| `delete item <key>` | Delete item |

### Content (Quests, Dialogues, Cutscenes, Storylines)
| Command | Description |
|---------|-------------|
| `create quest <key> <title>` | Create quest |
| `create dialogue <key>` | Create dialogue |
| `create cutscene <key> <title>` | Create cutscene |
| `create storyline <key> <title>` | Create storyline |
| `delete <type> <key>` | Delete content |
| `quest info <key>` | Show quest details |
| `dialogue info <key>` | Show dialogue details |

### Scripts
| Command | Description |
|---------|-------------|
| `script create <key> <name>` | Create script |
| `script templates` | List templates |
| `script from-template <tpl> <key>` | Create from template |
| `script attach <script> <entity>` | Attach to entity |
| `script detach <script> <entity>` | Detach from entity |
| `script validate <key>` | Validate script |
| `script test <key>` | Test script |

### Zones
| Command | Description |
|---------|-------------|
| `create zone <key> <name>` | Create zone |
| `edit zone <key> <field> <value>` | Edit zone |
| `delete zone <key>` | Delete zone |
| `zone info <key>` | Show zone details |

### Inspection
| Command | Description |
|---------|-------------|
| `info <key>` | Show entity/content details |
| `list <type>` | List all of type (npcs, items, quests, etc.) |
| `find <query>` | Search across all content |

### Testing
| Command | Description |
|---------|-------------|
| `spawn <key>` | Spawn entity in current room |
| `purge` | Remove all spawned test entities |
| `give <item_key>` | Give item to self |
| `setflag <flag>` / `clearflag <flag>` | Set/clear player flags |
| `startquest <key>` / `resetquest <key>` | Quest management |
| `godmode` | Toggle invincibility |

### World
| Command | Description |
|---------|-------------|
| `reload` | Reload all YAML content |
| `validate` | Run content validation |
| `settime <hour>` | Set time of day |

### AI
| Command | Description |
|---------|-------------|
| `/ai <prompt>` | Send prompt to AI |
| `chat` | Toggle chat mode (all input goes to AI) |
| `/ai clear` | Clear AI conversation |

### Help
| Command | Description |
|---------|-------------|
| `help` | Show all command categories |
| `help <category>` | Show commands in category |

## AI Integration

### Terminal Chat (`/ai` commands)
1. User types `/ai create a goblin camp with 3 rooms`
2. `CommandParser` returns `{:builder_ai, %{prompt: "create a goblin camp..."}}`
3. `BuilderCommands.AI` sends prompt to `Loka.AI.Conversation`
4. AI response streams back via Channel events
5. Tool calls (e.g., `create_room`) execute through `ToolExecutor`
6. Results stream back to terminal

### MCP Server (Claude Desktop)
Same `ToolExecutor` exposed via JSON-RPC 2.0 MCP protocol at `/world_builder_mcp`. Claude Desktop connects directly; no API cost.

## Terminal Markup

Clickable commands use `{{cmd:COMMAND}}text{{/cmd}}` syntax:

```elixir
# In builder command output:
"Go to {{cmd:goto town_square}}Town Square{{/cmd}}"

# Rendered in terminal as clickable text that executes the command on click
```

The `terminalMarkup.js` module parses this on the client side, and `Formatter.display_length/1` strips tags for column width calculation.

## File Map

### Frontend (Browser)
| File | Purpose |
|------|---------|
| `assets/js/hooks/mud_terminal.js` | Phoenix Channel connection, terminal I/O |
| `assets/js/hooks/terminalMarkup.js` | `{{cmd:}}` markup parser |
| `assets/js/hooks/HookHelper.js` | Listener lifecycle management |
| `assets/js/hooks/chat_textarea.js` | Chat input with Enter/Shift+Enter |
| `assets/css/builder/terminal.css` | Terminal styling |
| `assets/css/builder.css` | Builder page layout |

### Command Layer (Phoenix Channel)
| File | Purpose |
|------|---------|
| `lib/loka_web/channels/game_channel.ex` | Channel handler, admin gating |
| `lib/loka_web/channels/command_parser.ex` | Input → `{:builder_*, params}` |
| `lib/loka_web/channels/builder_commands.ex` | Dispatcher to 16 sub-modules |
| `lib/loka_web/channels/builder_commands/*.ex` | 16 command modules |

### Backend (World Builder)
| File | Purpose |
|------|---------|
| `lib/loka/world_builder/room_manager.ex` | Room YAML CRUD |
| `lib/loka/world_builder/entity_manager.ex` | NPC/Item YAML CRUD |
| `lib/loka/world_builder/quest_manager.ex` | Quest YAML CRUD |
| `lib/loka/world_builder/dialogue_manager.ex` | Dialogue YAML CRUD |
| `lib/loka/world_builder/validation_manager.ex` | Content validation |
| `lib/loka/world_builder/tool_executor.ex` | AI tool call execution |
| `lib/loka/world_builder/yaml_builder.ex` | YAML generation |
| `lib/loka/world_builder/anthropic_client.ex` | Claude API (streaming SSE) |
| `lib/loka/world_builder/script_templates.ex` | 15 script templates |
| `lib/loka/world_builder/audit_log.ex` | Action logging |
| `lib/loka/world_builder/mcp/*.ex` | MCP server (3 files) |

### LiveView (Admin Page)
| File | Purpose |
|------|---------|
| `lib/loka_web/live/admin_live/builder_live.ex` | Builder page layout |

## Testing

```bash
# Command parser tests
mix test test/loka_web/channels/command_parser_test.exs

# Formatter tests
mix test test/loka_web/channels/builder_commands/formatter_test.exs

# Security tests (admin-only gating)
mix test test/loka_web/channels/builder_command_security_test.exs

# CRUD integration tests
mix test test/loka_web/channels/builder_crud_test.exs

# YAML builder tests
mix test test/loka/world_builder/yaml_builder_test.exs

# All channel tests
mix test test/loka_web/channels/
```
