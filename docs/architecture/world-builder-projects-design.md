# World Builder Projects System Design

## Overview

The Projects system transforms the World Builder from a content creation tool into a complete creative workflow. It enables the LLM to:

1. **Design** - Create world concepts, narratives, characters, locations
2. **Plan** - Track what's built vs planned, make decisions
3. **Build** - Create actual game content (rooms, NPCs, quests)
4. **Iterate** - Update both design docs and content as ideas evolve

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  WORLD BUILDER UI                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────────────────────────────┐ │
│  │  Projects    │  │  Document Viewer                     │ │
│  │  Sidebar     │  │  (Markdown Preview)                  │ │
│  │              │  │                                      │ │
│  │  > seedship  │  │  # Seedship Forest                   │ │
│  │    - CONCEPT │  │                                      │ │
│  │    - CHARS   │  │  A world grown from a crashed        │ │
│  │    - LOCS    │  │  generation ship...                  │ │
│  │    - STATUS  │  │                                      │ │
│  │              │  │                                      │ │
│  └──────────────┘  └──────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  LLM Chat Panel                                        │ │
│  │  (with project context)                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### project_documents

Stores all project documents (design, planning, notes).

```sql
CREATE TABLE project_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  doc_type VARCHAR(50) NOT NULL DEFAULT 'design',
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(project_key, filename)
);

CREATE INDEX idx_project_documents_project ON project_documents(project_key);
CREATE INDEX idx_project_documents_type ON project_documents(doc_type);
```

**doc_type values:**
- `design` - World concept, characters, locations, narrative structure
- `planning` - Build status, session logs, decisions
- `notes` - Freeform notes, ideas, research

### world_builder_audit_log

Tracks every LLM action for debugging and auditing.

```sql
CREATE TABLE world_builder_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key VARCHAR(255),
  conversation_id VARCHAR(255),
  user_id INTEGER,
  tool_name VARCHAR(100) NOT NULL,
  tool_args TEXT NOT NULL,
  result_status VARCHAR(20) NOT NULL,
  result_detail TEXT,
  llm_response TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_audit_project ON world_builder_audit_log(project_key);
CREATE INDEX idx_audit_conversation ON world_builder_audit_log(conversation_id);
CREATE INDEX idx_audit_created ON world_builder_audit_log(created_at);
```

## LLM Tools

### Project Management

| Tool | Parameters | Description |
|------|------------|-------------|
| `create_project` | `key`, `name`, `description` | Create new project |
| `list_projects` | - | List all projects |
| `load_project` | `key` | Load project, get overview |
| `delete_project` | `key` | Delete project and all docs |

### Document Operations

| Tool | Parameters | Description |
|------|------------|-------------|
| `write_doc` | `filename`, `content`, `doc_type?` | Create/update document |
| `read_doc` | `filename` | Read document content |
| `list_docs` | `doc_type?` | List docs, optionally filtered |
| `delete_doc` | `filename` | Delete document |

### Guidance Access

| Tool | Parameters | Description |
|------|------------|-------------|
| `read_guide` | `topic` | Read builder guidance on topic |

**Available topics:**
- `narrative_style` - Writing voice, formatting rules
- `world_design_phases` - 9-phase design process
- `story_structure` - 108-beat structure, acts
- `entity_reference` - Room, NPC, Item, Quest YAML specs
- `dialogue_patterns` - Dialogue tree format, conditions
- `behaviors` - NPC behavior components
- `scripting` - Script API reference

## System Prompt Enhancement

The system prompt will be significantly enhanced with world building guidance.

### Core Principles (Always Included)

```
## Your Role

You are a world-building collaborator helping create rich, meaningful game worlds.
You can both DESIGN (create planning documents) and BUILD (create game content).

## Design-First Workflow

When starting a new world:
1. First understand the creator's vision through questions
2. Create design documents (WORLD-CONCEPT, CHARACTERS, LOCATIONS, etc.)
3. Get approval before building actual content
4. Build content that matches the design
5. Update design docs as ideas evolve

## Narrative Voice

- Show, don't tell: Describe behavior and environment, not emotional states
- Sensory grounding: Include specific textures, sounds, smells
- Subtext in dialogue: Characters rarely say exactly what they mean
- Action beats: Interrupt dialogue with physical actions

## Formatting Rules

- No hyphens for pauses: Use ... or em dash —
- No hyphenated compounds in prose: Write "gut wrenching" not "gut-wrenching"
- Em dashes for interruption: "I was going to—" she stopped.
- Ellipsis for trailing off: "I thought maybe..."

## MUD Content Formats

| Format | Purpose | When to Use |
|--------|---------|-------------|
| Dialogue tree | Primary interaction | Default for NPC conversations |
| Room description | Sets sensory baseline | On room entry |
| Emote | NPC periodic behavior | Ambient life, every 30-60s |
| Cutscene | Narrative sequence | RARE: major reveals only |

## Anti-Patterns to Avoid

- Don't create content without understanding the vision first
- Don't build rooms/NPCs without design docs as reference
- Don't use cutscenes for conversations (use dialogue trees)
- Don't tell emotions ("she felt sad") - show behavior
- Don't over-explain in room descriptions
```

### Project-Specific Context (Injected When Project Loaded)

```
## Active Project: {project_name}

### Design Documents
{list of docs with summaries}

### Build Status
- Zones: {built}/{planned}
- Rooms: {built}/{planned}
- NPCs: {built}/{planned}
- Quests: {built}/{planned}

### Recent Session Notes
{last few lines from session log}
```

## UI Components

### Projects Sidebar

Located on left side of World Builder, shows:
- List of projects (expandable)
- Documents within each project
- Quick actions (new project, new doc)

```jsx
<ProjectsSidebar>
  <ProjectList>
    <Project key="seedship-forest" expanded={true}>
      <ProjectHeader>
        <Icon type="folder" />
        <Name>Seedship Forest</Name>
        <Actions>
          <LoadButton />
          <DeleteButton />
        </Actions>
      </ProjectHeader>
      <DocumentList>
        <Document type="design">WORLD-CONCEPT.md</Document>
        <Document type="design">CHARACTERS.md</Document>
        <Document type="design">LOCATIONS.md</Document>
        <Document type="planning">BUILD-STATUS.md</Document>
      </DocumentList>
    </Project>
  </ProjectList>
  <NewProjectButton />
</ProjectsSidebar>
```

### Document Viewer

Center panel shows selected document:
- Markdown rendering
- Read-only (LLM edits via chat)
- Version history dropdown
- Export button

### Chat Panel Enhancements

- Shows active project name
- Context summary includes project status
- Conversation ID for audit tracking

## Implementation Plan

### Phase 1: Database & Backend (Elixir)

1. Create Ecto schemas for `project_documents` and `world_builder_audit_log`
2. Create migration
3. Create `Loka.WorldBuilder.Projects` context module with CRUD operations
4. Create `Loka.WorldBuilder.AuditLog` module for logging

### Phase 2: LLM Tools (JavaScript)

1. Add project tools to `ToolDefinitions.js`
2. Add document tools to `ToolDefinitions.js`
3. Add guidance tools to `ToolDefinitions.js`
4. Update tool execution in `world_builder_live.ex`

### Phase 3: System Prompt Enhancement

1. Create `world_builder_system_prompt.md` with full guidance
2. Load and inject into chat context
3. Add project-specific context injection

### Phase 4: UI Components (React + LiveView)

1. Create ProjectsSidebar component
2. Create DocumentViewer component
3. Wire up to LiveView events
4. Add project state management

### Phase 5: Export & Backup

1. Create `mix loka.export_project` task
2. Create `mix loka.import_project` task
3. Add export button to UI

## File Locations

| Component | Location |
|-----------|----------|
| Ecto Schemas | `lib/loka/world_builder/schemas/` |
| Context Modules | `lib/loka/world_builder/` |
| Migration | `priv/repo/migrations/` |
| Tool Definitions | `assets/js/world_builder/ToolDefinitions.js` |
| System Prompt | `priv/world_builder/system_prompt.md` |
| Guidance Docs | `priv/world_builder/guides/` |
| React Components | `assets/js/world_builder/` |
| LiveView | `lib/loka_web/live/admin_live/world_builder_live.ex` |

## Security Considerations

1. **No direct file writes** - All docs stored in database
2. **Project key validation** - Only alphanumeric, dash, underscore
3. **Filename validation** - Whitelist of allowed characters
4. **Content size limits** - Max 500KB per document
5. **Audit logging** - All actions tracked with user ID
6. **Rate limiting** - Max 100 tool calls per minute per user

## Migration Path

1. Existing worlds continue to work (YAML-based)
2. Projects are optional - can still use tool-only workflow
3. Can export project docs to files for git backup
4. Can import existing design docs into a project
