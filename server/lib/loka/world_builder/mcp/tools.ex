defmodule Loka.WorldBuilder.MCP.Tools do
  @moduledoc """
  MCP tool definitions for the World Builder.

  Exposes all World Builder tools via the Model Context Protocol,
  allowing Claude Desktop/Code to interact with the world building system.
  """

  alias Loka.WorldBuilder.ToolExecutor

  @doc """
  Returns all World Builder tools in MCP format.
  """
  def tools do
    project_tools() ++
      document_tools() ++
      guidance_tools() ++
      room_tools() ++
      entity_tools() ++
      quest_tools() ++
      dialogue_tools() ++
      query_tools()
  end

  @doc """
  Dispatch a tool call to the appropriate handler.
  """
  def dispatch(name, args, opts \\ []) do
    ToolExecutor.execute(name, args, opts)
  end

  # Project management tools
  defp project_tools do
    [
      %{
        name: "wb_create_project",
        description: """
        Create a new World Builder project. Projects organize world design documents
        and track the creative process. Use this when starting work on a new world or game area.
        """,
        inputSchema: %{
          type: "object",
          required: ["key", "name"],
          properties: %{
            key: %{
              type: "string",
              description:
                "Unique project identifier (lowercase, underscores, e.g., 'forest_realm')"
            },
            name: %{
              type: "string",
              description: "Human-readable project name"
            },
            description: %{
              type: "string",
              description: "Brief description of the project's scope and goals"
            }
          }
        },
        callback: fn args -> dispatch("create_project", args) end
      },
      %{
        name: "wb_load_project",
        description: """
        Load an existing project to work on. Returns project metadata and list of documents.
        """,
        inputSchema: %{
          type: "object",
          required: ["key"],
          properties: %{
            key: %{type: "string", description: "Project key to load"}
          }
        },
        callback: fn args -> dispatch("load_project", args) end
      },
      %{
        name: "wb_list_projects",
        description: """
        List all World Builder projects. Use to see available projects before loading one.
        """,
        inputSchema: %{
          type: "object",
          properties: %{}
        },
        callback: fn _args -> dispatch("list_projects", %{}) end
      },
      %{
        name: "wb_delete_project",
        description: """
        Delete a project and all its documents. This is irreversible.
        """,
        inputSchema: %{
          type: "object",
          required: ["key"],
          properties: %{
            key: %{type: "string", description: "Project key to delete"}
          }
        },
        callback: fn args -> dispatch("delete_project", args) end
      }
    ]
  end

  # Document management tools
  defp document_tools do
    [
      %{
        name: "wb_write_doc",
        description: """
        Write or update a design document in the current project. Documents are versioned automatically.
        Use for world bibles, character sheets, quest outlines, area designs, etc.

        Document types:
        - design: Core design documents (world bible, character sheets)
        - planning: Implementation plans, task lists
        - notes: Research, ideas, brainstorming
        """,
        inputSchema: %{
          type: "object",
          required: ["project_key", "filename", "content"],
          properties: %{
            project_key: %{type: "string", description: "Project to write document in"},
            filename: %{type: "string", description: "Document filename (e.g., 'world_bible.md')"},
            content: %{type: "string", description: "Document content in markdown format"},
            doc_type: %{
              type: "string",
              enum: ["design", "planning", "notes"],
              description: "Document type (default: design)"
            }
          }
        },
        callback: fn args ->
          dispatch("write_doc", args, project_key: args["project_key"])
        end
      },
      %{
        name: "wb_read_doc",
        description: """
        Read a design document from a project. Returns the document content and metadata.
        """,
        inputSchema: %{
          type: "object",
          required: ["project_key", "filename"],
          properties: %{
            project_key: %{type: "string", description: "Project containing the document"},
            filename: %{type: "string", description: "Document filename to read"}
          }
        },
        callback: fn args ->
          dispatch("read_doc", args, project_key: args["project_key"])
        end
      },
      %{
        name: "wb_list_docs",
        description: """
        List all documents in a project.
        """,
        inputSchema: %{
          type: "object",
          required: ["project_key"],
          properties: %{
            project_key: %{type: "string", description: "Project to list documents from"}
          }
        },
        callback: fn args ->
          dispatch("list_docs", args, project_key: args["project_key"])
        end
      },
      %{
        name: "wb_delete_doc",
        description: """
        Delete a document from a project.
        """,
        inputSchema: %{
          type: "object",
          required: ["project_key", "filename"],
          properties: %{
            project_key: %{type: "string", description: "Project containing the document"},
            filename: %{type: "string", description: "Document filename to delete"}
          }
        },
        callback: fn args ->
          dispatch("delete_doc", args, project_key: args["project_key"])
        end
      }
    ]
  end

  # Framework guidance tools
  defp guidance_tools do
    [
      %{
        name: "wb_read_guide",
        description: """
        Read a framework guide for world building best practices. Available guides:

        - world_design_process: 9-phase workflow for world creation
        - narrative_style: Writing voice, sensory grounding, dialogue
        - story_structure: 108-beat story structure, pacing
        - weaving_patterns: Thread interconnection, callbacks
        - entity_patterns: Room, NPC, item design patterns
        - dialogue_patterns: Dialogue tree format, branching
        - quest_patterns: Quest design, objectives, rewards
        - npc_behaviors: Behaviors, emotes, schedules

        Use these guides to understand the framework and ensure consistent quality.
        """,
        inputSchema: %{
          type: "object",
          required: ["topic"],
          properties: %{
            topic: %{
              type: "string",
              enum: [
                "world_design_process",
                "narrative_style",
                "story_structure",
                "weaving_patterns",
                "entity_patterns",
                "dialogue_patterns",
                "quest_patterns",
                "npc_behaviors"
              ],
              description: "Guide topic to read"
            }
          }
        },
        callback: fn args -> dispatch("read_guide", args) end
      }
    ]
  end

  # Room management tools
  defp room_tools do
    [
      %{
        name: "wb_create_room",
        description: """
        Create a new room in the world. Rooms are the basic spatial unit.
        Include rich sensory descriptions following the narrative style guide.
        """,
        inputSchema: %{
          type: "object",
          required: ["key", "name", "description"],
          properties: %{
            key: %{type: "string", description: "Unique room key (e.g., 'forest_clearing')"},
            name: %{type: "string", description: "Room display name"},
            description: %{type: "string", description: "Rich sensory description of the room"},
            zone: %{type: "string", description: "Zone this room belongs to"},
            x: %{type: "integer", description: "X coordinate for mapping"},
            y: %{type: "integer", description: "Y coordinate for mapping"},
            z: %{type: "integer", description: "Z coordinate (floor level)"},
            tags: %{
              type: "array",
              items: %{type: "string"},
              description: "Room tags (e.g., ['outdoor', 'safe_zone'])"
            }
          }
        },
        callback: fn args -> dispatch("create_room", args) end
      },
      %{
        name: "wb_update_room",
        description: """
        Update an existing room's properties.
        """,
        inputSchema: %{
          type: "object",
          required: ["key"],
          properties: %{
            key: %{type: "string", description: "Room key to update"},
            name: %{type: "string", description: "New room name"},
            description: %{type: "string", description: "New description"},
            zone: %{type: "string", description: "New zone"},
            tags: %{type: "array", items: %{type: "string"}, description: "New tags"}
          }
        },
        callback: fn args -> dispatch("update_room", args) end
      },
      %{
        name: "wb_delete_room",
        description: """
        Delete a room from the world. Also removes any exits pointing to this room.
        """,
        inputSchema: %{
          type: "object",
          required: ["key"],
          properties: %{
            key: %{type: "string", description: "Room key to delete"}
          }
        },
        callback: fn args -> dispatch("delete_room", args) end
      },
      %{
        name: "wb_create_exit",
        description: """
        Create an exit connecting two rooms. Exits are one-way by default.
        Use 'bidirectional: true' to create exits in both directions.
        """,
        inputSchema: %{
          type: "object",
          required: ["from_room", "direction", "to_room"],
          properties: %{
            from_room: %{type: "string", description: "Source room key"},
            direction: %{
              type: "string",
              description: "Exit direction (north, south, east, west, up, down, or custom)"
            },
            to_room: %{type: "string", description: "Destination room key"},
            bidirectional: %{
              type: "boolean",
              description: "Create return exit automatically"
            }
          }
        },
        callback: fn args -> dispatch("create_exit", args) end
      },
      %{
        name: "wb_remove_exit",
        description: """
        Remove an exit from a room.
        """,
        inputSchema: %{
          type: "object",
          required: ["from_room", "direction"],
          properties: %{
            from_room: %{type: "string", description: "Room containing the exit"},
            direction: %{type: "string", description: "Exit direction to remove"}
          }
        },
        callback: fn args -> dispatch("remove_exit", args) end
      },
      %{
        name: "wb_batch_create_rooms",
        description: """
        Create multiple rooms at once with automatic exit connections.
        Efficient for building larger areas. Each room needs key, name, description.
        Connections specify exits between rooms in the batch.
        """,
        inputSchema: %{
          type: "object",
          required: ["rooms"],
          properties: %{
            rooms: %{
              type: "array",
              items: %{
                type: "object",
                properties: %{
                  key: %{type: "string"},
                  name: %{type: "string"},
                  description: %{type: "string"},
                  zone: %{type: "string"},
                  x: %{type: "integer"},
                  y: %{type: "integer"}
                }
              },
              description: "Array of room definitions"
            },
            connections: %{
              type: "array",
              items: %{
                type: "object",
                properties: %{
                  from: %{type: "string"},
                  direction: %{type: "string"},
                  to: %{type: "string"}
                }
              },
              description: "Array of exit connections"
            }
          }
        },
        callback: fn args -> dispatch("batch_create_rooms", args) end
      }
    ]
  end

  # Entity management tools
  defp entity_tools do
    [
      %{
        name: "wb_create_npc",
        description: """
        Create a new NPC (non-player character). NPCs need personality, behaviors,
        and optionally dialogue trees. Follow the narrative style guide for writing.
        """,
        inputSchema: %{
          type: "object",
          required: ["key", "name"],
          properties: %{
            key: %{type: "string", description: "Unique NPC key"},
            name: %{type: "string", description: "NPC display name"},
            description: %{type: "string", description: "Physical description"},
            room: %{type: "string", description: "Starting room key"},
            dialogue: %{type: "string", description: "Dialogue tree key"},
            behaviors: %{
              type: "array",
              items: %{type: "string"},
              description: "Behavior scripts (e.g., ['patrol', 'merchant'])"
            },
            stats: %{
              type: "object",
              description: "NPC stats (level, health, etc.)"
            }
          }
        },
        callback: fn args -> dispatch("create_npc", args) end
      },
      %{
        name: "wb_create_item",
        description: """
        Create a new item. Items can be equipment, consumables, quest items, etc.
        """,
        inputSchema: %{
          type: "object",
          required: ["key", "name"],
          properties: %{
            key: %{type: "string", description: "Unique item key"},
            name: %{type: "string", description: "Item display name"},
            description: %{type: "string", description: "Item description"},
            item_type: %{
              type: "string",
              enum: ["weapon", "armor", "consumable", "quest", "key", "misc"],
              description: "Item category"
            },
            stats: %{
              type: "object",
              description: "Item stats (damage, armor, effects, etc.)"
            },
            value: %{type: "integer", description: "Base gold value"}
          }
        },
        callback: fn args -> dispatch("create_item", args) end
      },
      %{
        name: "wb_list_npcs",
        description: """
        List all NPCs, optionally filtered by zone or room.
        """,
        inputSchema: %{
          type: "object",
          properties: %{
            zone: %{type: "string", description: "Filter by zone"},
            room: %{type: "string", description: "Filter by room"}
          }
        },
        callback: fn args -> dispatch("list_npcs", args) end
      },
      %{
        name: "wb_list_items",
        description: """
        List all items, optionally filtered by type.
        """,
        inputSchema: %{
          type: "object",
          properties: %{
            item_type: %{type: "string", description: "Filter by item type"}
          }
        },
        callback: fn args -> dispatch("list_items", args) end
      }
    ]
  end

  # Quest management tools
  defp quest_tools do
    [
      %{
        name: "wb_create_quest",
        description: """
        Create a new quest with objectives and rewards. Follow quest_patterns guide
        for structure. Quests should have clear goals and meaningful rewards.
        """,
        inputSchema: %{
          type: "object",
          required: ["key", "name", "description"],
          properties: %{
            key: %{type: "string", description: "Unique quest key"},
            name: %{type: "string", description: "Quest display name"},
            description: %{type: "string", description: "Quest description shown to player"},
            giver: %{type: "string", description: "NPC key who gives the quest"},
            objectives: %{
              type: "array",
              items: %{
                type: "object",
                properties: %{
                  type: %{type: "string"},
                  target: %{type: "string"},
                  count: %{type: "integer"},
                  description: %{type: "string"}
                }
              },
              description: "Quest objectives"
            },
            rewards: %{
              type: "object",
              properties: %{
                xp: %{type: "integer"},
                gold: %{type: "integer"},
                items: %{type: "array", items: %{type: "string"}}
              },
              description: "Quest rewards"
            },
            prerequisites: %{
              type: "array",
              items: %{type: "string"},
              description: "Quest keys that must be completed first"
            }
          }
        },
        callback: fn args -> dispatch("create_quest", args) end
      },
      %{
        name: "wb_update_quest",
        description: """
        Update an existing quest's properties.
        """,
        inputSchema: %{
          type: "object",
          required: ["key"],
          properties: %{
            key: %{type: "string", description: "Quest key to update"},
            name: %{type: "string"},
            description: %{type: "string"},
            objectives: %{type: "array", items: %{type: "object"}},
            rewards: %{type: "object"}
          }
        },
        callback: fn args -> dispatch("update_quest", args) end
      },
      %{
        name: "wb_list_quests",
        description: """
        List all quests, optionally filtered by giver NPC.
        """,
        inputSchema: %{
          type: "object",
          properties: %{
            giver: %{type: "string", description: "Filter by quest giver NPC key"}
          }
        },
        callback: fn args -> dispatch("list_quests", args) end
      }
    ]
  end

  # Dialogue management tools
  defp dialogue_tools do
    [
      %{
        name: "wb_create_dialogue",
        description: """
        Create a dialogue tree for NPC conversations. Follow dialogue_patterns guide
        for structure. Dialogues should have natural flow and meaningful choices.
        """,
        inputSchema: %{
          type: "object",
          required: ["key", "nodes"],
          properties: %{
            key: %{type: "string", description: "Unique dialogue key"},
            npc: %{type: "string", description: "NPC this dialogue belongs to"},
            nodes: %{
              type: "array",
              items: %{
                type: "object",
                properties: %{
                  id: %{type: "string"},
                  text: %{type: "string"},
                  choices: %{
                    type: "array",
                    items: %{
                      type: "object",
                      properties: %{
                        text: %{type: "string"},
                        next: %{type: "string"},
                        condition: %{type: "string"},
                        action: %{type: "string"}
                      }
                    }
                  }
                }
              },
              description: "Dialogue nodes with text and choices"
            }
          }
        },
        callback: fn args -> dispatch("create_dialogue", args) end
      },
      %{
        name: "wb_get_dialogue",
        description: """
        Get an existing dialogue tree by key.
        """,
        inputSchema: %{
          type: "object",
          required: ["key"],
          properties: %{
            key: %{type: "string", description: "Dialogue key to retrieve"}
          }
        },
        callback: fn args -> dispatch("get_dialogue", args) end
      }
    ]
  end

  # Query tools
  defp query_tools do
    [
      %{
        name: "wb_get_room_info",
        description: """
        Get detailed information about a room including exits, NPCs, and items.
        """,
        inputSchema: %{
          type: "object",
          required: ["key"],
          properties: %{
            key: %{type: "string", description: "Room key to query"}
          }
        },
        callback: fn args -> dispatch("get_room_info", args) end
      },
      %{
        name: "wb_list_rooms",
        description: """
        List all rooms, optionally filtered by zone.
        """,
        inputSchema: %{
          type: "object",
          properties: %{
            zone: %{type: "string", description: "Filter by zone"}
          }
        },
        callback: fn args -> dispatch("list_rooms", args) end
      },
      %{
        name: "wb_get_zone_info",
        description: """
        Get information about a zone including all its rooms.
        """,
        inputSchema: %{
          type: "object",
          required: ["key"],
          properties: %{
            key: %{type: "string", description: "Zone key to query"}
          }
        },
        callback: fn args -> dispatch("get_zone_info", args) end
      },
      %{
        name: "wb_list_zones",
        description: """
        List all zones in the world.
        """,
        inputSchema: %{
          type: "object",
          properties: %{}
        },
        callback: fn _args -> dispatch("list_zones", %{}) end
      }
    ]
  end
end
