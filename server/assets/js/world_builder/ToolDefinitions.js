/**
 * Tool Definitions for World Builder LLM
 *
 * Defines the tools available to Claude for world building tasks.
 * Each tool includes name, description, and JSON Schema for input validation.
 */

/**
 * Create a new room in the world
 */
export const createRoom = {
  name: 'create_room',
  description: 'Create a new room in the world. Use this when the user asks to add a new location or area.',
  input_schema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Unique identifier for the room (snake_case, no spaces). Example: "tavern_main", "forest_clearing"'
      },
      name: {
        type: 'string',
        description: 'Display name for the room. Example: "The Golden Tankard Tavern"'
      },
      description: {
        type: 'string',
        description: 'Detailed description of the room that players will see. Should be evocative and immersive.'
      },
      x: {
        type: 'integer',
        description: 'X coordinate for the room position in the world grid'
      },
      y: {
        type: 'integer',
        description: 'Y coordinate for the room position in the world grid'
      },
      z: {
        type: 'integer',
        description: 'Z coordinate (elevation/floor level). Default is 0.',
        default: 0
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization. Example: ["indoor", "tavern", "safe_zone"]'
      }
    },
    required: ['key', 'name', 'description']
  }
}

/**
 * Update an existing room
 */
export const updateRoom = {
  name: 'update_room',
  description: 'Update an existing room\'s properties. Use this to modify room name, description, coordinates, or tags.',
  input_schema: {
    type: 'object',
    properties: {
      room_key: {
        type: 'string',
        description: 'The key of the room to update'
      },
      name: {
        type: 'string',
        description: 'New display name (optional)'
      },
      description: {
        type: 'string',
        description: 'New description (optional)'
      },
      x: {
        type: 'integer',
        description: 'New X coordinate (optional)'
      },
      y: {
        type: 'integer',
        description: 'New Y coordinate (optional)'
      },
      z: {
        type: 'integer',
        description: 'New Z coordinate (optional)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'New tags (replaces existing, optional)'
      }
    },
    required: ['room_key']
  }
}

/**
 * Create an exit between two rooms
 */
export const createExit = {
  name: 'create_exit',
  description: 'Create an exit/connection between two rooms. Creates a one-way connection; use twice for two-way.',
  input_schema: {
    type: 'object',
    properties: {
      from_room: {
        type: 'string',
        description: 'Key of the source room'
      },
      direction: {
        type: 'string',
        enum: ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'up', 'down'],
        description: 'Direction of the exit'
      },
      to_room: {
        type: 'string',
        description: 'Key of the destination room'
      }
    },
    required: ['from_room', 'direction', 'to_room']
  }
}

/**
 * Remove an exit from a room
 */
export const removeExit = {
  name: 'remove_exit',
  description: 'Remove an exit from a room.',
  input_schema: {
    type: 'object',
    properties: {
      from_room: {
        type: 'string',
        description: 'Key of the room to remove exit from'
      },
      direction: {
        type: 'string',
        enum: ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'up', 'down'],
        description: 'Direction of the exit to remove'
      }
    },
    required: ['from_room', 'direction']
  }
}

/**
 * Delete a room
 */
export const deleteRoom = {
  name: 'delete_room',
  description: 'Delete a room from the world. Warning: This is permanent.',
  input_schema: {
    type: 'object',
    properties: {
      room_key: {
        type: 'string',
        description: 'Key of the room to delete'
      }
    },
    required: ['room_key']
  }
}

/**
 * Create an NPC
 */
export const createNPC = {
  name: 'create_npc',
  description: 'Create a new NPC (Non-Player Character) in the world.',
  input_schema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Unique identifier for the NPC (snake_case). Example: "guard_captain"'
      },
      name: {
        type: 'string',
        description: 'Display name of the NPC. Example: "Captain Reeves"'
      },
      description: {
        type: 'string',
        description: 'Description of the NPC\'s appearance and demeanor'
      },
      level: {
        type: 'integer',
        description: 'NPC level (default: 1)',
        default: 1
      },
      room_key: {
        type: 'string',
        description: 'Key of the room where NPC spawns (optional)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags like "friendly", "merchant", "quest_giver"'
      }
    },
    required: ['key', 'name', 'description']
  }
}

/**
 * Create an item
 */
export const createItem = {
  name: 'create_item',
  description: 'Create a new item that can exist in the world.',
  input_schema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Unique identifier for the item (snake_case). Example: "iron_sword"'
      },
      name: {
        type: 'string',
        description: 'Display name. Example: "Iron Sword"'
      },
      description: {
        type: 'string',
        description: 'Description of the item\'s appearance'
      },
      item_type: {
        type: 'string',
        enum: ['weapon', 'armor', 'consumable', 'key', 'quest', 'misc'],
        description: 'Type of item'
      },
      room_key: {
        type: 'string',
        description: 'Key of the room where item spawns (optional)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for the item'
      }
    },
    required: ['key', 'name', 'description', 'item_type']
  }
}

/**
 * Get information about a room
 */
export const getRoomInfo = {
  name: 'get_room_info',
  description: 'Get detailed information about a specific room.',
  input_schema: {
    type: 'object',
    properties: {
      room_key: {
        type: 'string',
        description: 'Key of the room to get info about'
      }
    },
    required: ['room_key']
  }
}

/**
 * List all rooms
 */
export const listRooms = {
  name: 'list_rooms',
  description: 'List all rooms in the world with their basic info.',
  input_schema: {
    type: 'object',
    properties: {
      filter_tag: {
        type: 'string',
        description: 'Optional tag to filter rooms by'
      }
    },
    required: []
  }
}

/**
 * Batch create multiple rooms at once
 */
export const batchCreateRooms = {
  name: 'batch_create_rooms',
  description: 'Create multiple rooms at once. More efficient for creating several connected rooms.',
  input_schema: {
    type: 'object',
    properties: {
      rooms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            x: { type: 'integer' },
            y: { type: 'integer' },
            z: { type: 'integer' },
            tags: { type: 'array', items: { type: 'string' } }
          },
          required: ['key', 'name', 'description']
        },
        description: 'Array of rooms to create'
      }
    },
    required: ['rooms']
  }
}

/**
 * All available tools
 */
export const allTools = [
  createRoom,
  updateRoom,
  createExit,
  removeExit,
  deleteRoom,
  createNPC,
  createItem,
  getRoomInfo,
  listRooms,
  batchCreateRooms
]

// ============================================================================
// Project Management Tools
// ============================================================================

/**
 * Create a new project
 */
export const createProject = {
  name: 'create_project',
  description: 'Create a new world-building project. Use this when starting work on a new game world.',
  input_schema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Unique identifier for the project (lowercase, dashes/underscores allowed). Example: "seedship-forest"'
      },
      name: {
        type: 'string',
        description: 'Display name for the project. Example: "Seedship Forest"'
      },
      description: {
        type: 'string',
        description: 'Brief description of the world concept'
      }
    },
    required: ['key', 'name']
  }
}

/**
 * Load an existing project
 */
export const loadProject = {
  name: 'load_project',
  description: 'Load an existing project to continue working on it. Returns project overview with all documents.',
  input_schema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Project key to load'
      }
    },
    required: ['key']
  }
}

/**
 * List all projects
 */
export const listProjects = {
  name: 'list_projects',
  description: 'List all available world-building projects.',
  input_schema: {
    type: 'object',
    properties: {},
    required: []
  }
}

/**
 * Delete a project
 */
export const deleteProject = {
  name: 'delete_project',
  description: 'Delete a project and all its documents. Warning: This is permanent.',
  input_schema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Project key to delete'
      }
    },
    required: ['key']
  }
}

// ============================================================================
// Document Tools
// ============================================================================

/**
 * Write/update a document
 */
export const writeDoc = {
  name: 'write_doc',
  description: 'Create or update a document in the current project. Use for design docs (WORLD-CONCEPT.md, CHARACTERS.md), planning (BUILD-STATUS.md), or notes.',
  input_schema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Document filename with extension. Example: "WORLD-CONCEPT.md", "CHARACTERS.md", "BUILD-STATUS.md"'
      },
      content: {
        type: 'string',
        description: 'Markdown content for the document'
      },
      doc_type: {
        type: 'string',
        enum: ['design', 'planning', 'notes'],
        description: 'Type of document. "design" for world design, "planning" for build tracking, "notes" for freeform'
      }
    },
    required: ['filename', 'content']
  }
}

/**
 * Read a document
 */
export const readDoc = {
  name: 'read_doc',
  description: 'Read a document from the current project.',
  input_schema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Document filename to read'
      }
    },
    required: ['filename']
  }
}

/**
 * List documents in a project
 */
export const listDocs = {
  name: 'list_docs',
  description: 'List all documents in the current project.',
  input_schema: {
    type: 'object',
    properties: {
      doc_type: {
        type: 'string',
        enum: ['design', 'planning', 'notes'],
        description: 'Optional filter by document type'
      }
    },
    required: []
  }
}

/**
 * Delete a document
 */
export const deleteDoc = {
  name: 'delete_doc',
  description: 'Delete a document from the current project.',
  input_schema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Document filename to delete'
      }
    },
    required: ['filename']
  }
}

// ============================================================================
// Guidance Tools
// ============================================================================

/**
 * Read framework guidance
 */
export const readGuide = {
  name: 'read_guide',
  description: 'Read framework guidance documentation on a specific topic.',
  input_schema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        enum: [
          'world_design_process',
          'narrative_style',
          'story_structure',
          'weaving_patterns',
          'entity_patterns',
          'dialogue_patterns',
          'quest_patterns',
          'npc_behaviors'
        ],
        description: 'Topic to get guidance on'
      }
    },
    required: ['topic']
  }
}

/**
 * All available tools
 */
export const allTools = [
  // Project management
  createProject,
  loadProject,
  listProjects,
  deleteProject,
  // Documents
  writeDoc,
  readDoc,
  listDocs,
  deleteDoc,
  // Guidance
  readGuide,
  // World building (existing)
  createRoom,
  updateRoom,
  createExit,
  removeExit,
  deleteRoom,
  createNPC,
  createItem,
  getRoomInfo,
  listRooms,
  batchCreateRooms
]

/**
 * Get a subset of tools by name
 * @param {string[]} names - Tool names to include
 * @returns {Object[]} Selected tools
 */
export function getTools(names) {
  return allTools.filter(tool => names.includes(tool.name))
}

/**
 * Get all world building tools (room/exit related)
 */
export function getWorldBuildingTools() {
  return getTools([
    'create_room',
    'update_room',
    'create_exit',
    'remove_exit',
    'delete_room',
    'get_room_info',
    'list_rooms',
    'batch_create_rooms'
  ])
}

/**
 * Get entity creation tools (NPC/item)
 */
export function getEntityTools() {
  return getTools([
    'create_npc',
    'create_item'
  ])
}

/**
 * Get project management tools
 */
export function getProjectTools() {
  return getTools([
    'create_project',
    'load_project',
    'list_projects',
    'delete_project',
    'write_doc',
    'read_doc',
    'list_docs',
    'delete_doc',
    'read_guide'
  ])
}

export default {
  allTools,
  getTools,
  getWorldBuildingTools,
  getEntityTools,
  getProjectTools,
  // Project tools
  createProject,
  loadProject,
  listProjects,
  deleteProject,
  writeDoc,
  readDoc,
  listDocs,
  deleteDoc,
  readGuide,
  // World building tools
  createRoom,
  updateRoom,
  createExit,
  removeExit,
  deleteRoom,
  createNPC,
  createItem,
  getRoomInfo,
  listRooms,
  batchCreateRooms
}
