# World Builder MCP Setup

The World Builder exposes its tools via the Model Context Protocol (MCP), allowing Claude Desktop to interact directly with the world building system.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Desktop (or Claude Code)                             │
│   Your Claude subscription - no API costs                   │
└─────────────────────────────────────────────────────────────┘
                           │ MCP Protocol
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ World Builder MCP Server                                    │
│   http://localhost:4000/world_builder_mcp                   │
│   30+ tools for world building                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Loka Game Engine                                            │
│   YAML content files, database, validation                  │
└─────────────────────────────────────────────────────────────┘
```

## Setup for Claude Desktop

### 1. Start the Phoenix Server

```bash
cd server
mix phx.server
```

The MCP endpoint will be available at: `http://localhost:4000/world_builder_mcp`

### 2. Configure Claude Desktop

Add the following to your Claude Desktop settings (`claude_desktop_config.json`):

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "loka-world-builder": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-d", "@-",
        "http://localhost:4000/world_builder_mcp"
      ]
    }
  }
}
```

> **Note:** Claude Desktop's MCP support for HTTP servers may require using a proxy or wrapper. The above is a simplified example. Check Claude Desktop's current MCP documentation for the recommended HTTP transport setup.

### 3. Verify Connection

In Claude Desktop, you should see the World Builder tools available. Try:

```
List all World Builder projects
```

Claude should use the `wb_list_projects` tool.

## Available Tools

### Project Management
- `wb_create_project` - Create a new project
- `wb_load_project` - Load existing project
- `wb_list_projects` - List all projects
- `wb_delete_project` - Delete a project

### Document Management
- `wb_write_doc` - Create/update design documents
- `wb_read_doc` - Read a document
- `wb_list_docs` - List project documents
- `wb_delete_doc` - Delete a document

### Framework Guides
- `wb_read_guide` - Read best practices guides
  - world_design_process
  - narrative_style
  - story_structure
  - weaving_patterns
  - entity_patterns
  - dialogue_patterns
  - quest_patterns
  - npc_behaviors

### Room Tools
- `wb_create_room` - Create a room
- `wb_update_room` - Update room
- `wb_delete_room` - Delete room
- `wb_create_exit` - Connect rooms
- `wb_remove_exit` - Remove connection
- `wb_batch_create_rooms` - Bulk room creation

### Entity Tools
- `wb_create_npc` - Create NPC
- `wb_create_item` - Create item
- `wb_list_npcs` - List NPCs
- `wb_list_items` - List items

### Quest Tools
- `wb_create_quest` - Create quest
- `wb_update_quest` - Update quest
- `wb_list_quests` - List quests

### Dialogue Tools
- `wb_create_dialogue` - Create dialogue tree
- `wb_get_dialogue` - Get dialogue

### Query Tools
- `wb_get_room_info` - Room details
- `wb_list_rooms` - List rooms
- `wb_get_zone_info` - Zone details
- `wb_list_zones` - List zones

## Usage Examples

### Creating a New World

```
I want to create a new world called "Enchanted Forest". Start by creating a project and a world bible document.
```

Claude will:
1. Use `wb_create_project` to create the project
2. Use `wb_read_guide("world_design_process")` to understand the workflow
3. Use `wb_write_doc` to create a world bible

### Building Rooms

```
Create the entrance to the enchanted forest with paths leading north to a clearing and east to a stream.
```

Claude will:
1. Use `wb_create_room` for the entrance
2. Use `wb_create_room` for the clearing
3. Use `wb_create_room` for the stream
4. Use `wb_create_exit` to connect them

### Designing NPCs

```
Create a wise old owl NPC who guards the forest entrance and gives quests to new visitors.
```

Claude will:
1. Use `wb_read_guide("entity_patterns")` for NPC patterns
2. Use `wb_create_npc` with appropriate stats
3. Use `wb_create_dialogue` for conversation
4. Use `wb_create_quest` for the introductory quest

## Transitional UI

While MCP becomes mainstream, a LiveView chat interface is also available at:

```
http://localhost:4000/admin/world-builder
```

This uses the Anthropic API server-side (requires `ANTHROPIC_API_KEY` env var).

## Comparison

| Feature | MCP (Claude Desktop) | LiveView Chat |
|---------|---------------------|---------------|
| LLM Cost | Your Claude subscription | API per token |
| Interface | Claude Desktop | Web browser |
| Setup | Configure MCP | Set API key |
| Tools | Same 30+ tools | Same 30+ tools |

Long-term, MCP is the recommended approach as it:
- Uses your existing Claude subscription
- Benefits from Claude Desktop improvements
- Keeps the World Builder focused on tools, not chat UI
