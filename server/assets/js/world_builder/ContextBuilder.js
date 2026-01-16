/**
 * Context Builder for World Builder LLM
 *
 * Builds context from world state for the LLM to understand
 * the current state of the world being built.
 */

/**
 * Build a system prompt for the world builder assistant
 *
 * @param {Object} options
 * @param {string} options.worldName - Name of the world being built
 * @param {string} options.theme - Theme/genre of the world
 * @returns {string} System prompt
 */
export function buildSystemPrompt({ worldName = 'Unnamed World', theme = 'fantasy' } = {}) {
  return `You are an expert game world designer helping to build "${worldName}", a ${theme} world for a text-based RPG.

Your role is to help create immersive, interconnected locations with rich descriptions. When creating content:

1. **Rooms/Locations**: Create vivid, atmospheric descriptions that engage the senses. Each room should feel like a distinct place with its own character.

2. **Connections**: Think about how locations connect logically. A kitchen should be near a dining hall. Upper floors should connect via stairs.

3. **Consistency**: Maintain consistency with existing content. If the world has a certain tone or style, match it.

4. **Evocative Writing**: Use descriptive language that paints a picture. Avoid generic descriptions.

5. **Player Experience**: Consider how players will navigate and experience the space.

When using tools:
- Use snake_case for keys (e.g., "tavern_main_hall" not "Tavern Main Hall")
- Provide coordinates that make spatial sense
- Use appropriate tags for categorization
- Connect new rooms to existing ones when relevant

Always explain what you're creating and why. Ask clarifying questions if the request is ambiguous.`
}

/**
 * Build world context from current state
 *
 * @param {Object} options
 * @param {Array} options.rooms - All rooms in the world
 * @param {Object} options.selectedRoom - Currently selected room (if any)
 * @param {Array} options.npcs - All NPCs (optional)
 * @param {Array} options.items - All items (optional)
 * @returns {string} Context description
 */
export function buildWorldContext({ rooms = [], selectedRoom = null, npcs = [], items = [] } = {}) {
  let context = '## Current World State\n\n'

  // Room count
  context += `**Total Rooms:** ${rooms.length}\n\n`

  // Selected room details
  if (selectedRoom) {
    const room = rooms.find(r => r.key === selectedRoom || r.id === selectedRoom)
    if (room) {
      context += `### Currently Selected: ${room.name}\n`
      context += `- Key: \`${room.key}\`\n`
      context += `- Coordinates: (${room.x || 0}, ${room.y || 0}, ${room.z || 0})\n`
      context += `- Description: ${room.description || 'No description'}\n`

      if (room.exits && Object.keys(room.exits).length > 0) {
        context += `- Exits:\n`
        for (const [dir, dest] of Object.entries(room.exits)) {
          const destRoom = rooms.find(r => r.key === dest)
          context += `  - ${dir} -> ${destRoom?.name || dest}\n`
        }
      }

      if (room.spawns) {
        const { npcs: roomNpcs = [], items: roomItems = [] } = room.spawns
        if (roomNpcs.length > 0) {
          context += `- NPCs: ${roomNpcs.join(', ')}\n`
        }
        if (roomItems.length > 0) {
          context += `- Items: ${roomItems.join(', ')}\n`
        }
      }

      context += '\n'
    }
  }

  // Nearby rooms (if selected room exists)
  if (selectedRoom) {
    const room = rooms.find(r => r.key === selectedRoom || r.id === selectedRoom)
    if (room && room.exits) {
      const nearbyRooms = Object.values(room.exits)
        .map(key => rooms.find(r => r.key === key))
        .filter(Boolean)

      if (nearbyRooms.length > 0) {
        context += `### Nearby Rooms\n`
        for (const nearby of nearbyRooms) {
          context += `- **${nearby.name}** (\`${nearby.key}\`): ${truncate(nearby.description, 100)}\n`
        }
        context += '\n'
      }
    }
  }

  // Room summary
  if (rooms.length > 0 && rooms.length <= 20) {
    context += `### All Rooms\n`
    for (const room of rooms) {
      const exitCount = room.exits ? Object.keys(room.exits).length : 0
      context += `- **${room.name}** (\`${room.key}\`) at (${room.x || 0}, ${room.y || 0}) - ${exitCount} exits\n`
    }
    context += '\n'
  } else if (rooms.length > 20) {
    // Just list room names for large worlds
    context += `### Rooms (${rooms.length} total)\n`
    const roomList = rooms.slice(0, 30).map(r => r.key).join(', ')
    context += `${roomList}${rooms.length > 30 ? ', ...' : ''}\n\n`
  }

  // NPC summary
  if (npcs.length > 0) {
    context += `### NPCs (${npcs.length} total)\n`
    for (const npc of npcs.slice(0, 10)) {
      context += `- **${npc.name}** (\`${npc.key}\`)\n`
    }
    if (npcs.length > 10) {
      context += `- ... and ${npcs.length - 10} more\n`
    }
    context += '\n'
  }

  // Item summary
  if (items.length > 0) {
    context += `### Items (${items.length} total)\n`
    for (const item of items.slice(0, 10)) {
      context += `- **${item.name}** (\`${item.key}\`)\n`
    }
    if (items.length > 10) {
      context += `- ... and ${items.length - 10} more\n`
    }
    context += '\n'
  }

  return context
}

/**
 * Build messages array from chat history
 *
 * @param {Array} history - Array of {role, content} messages
 * @param {string} worldContext - World context to prepend
 * @returns {Array} Formatted messages
 */
export function buildMessages(history, worldContext = '') {
  const messages = []

  // Add world context as first user message if provided
  if (worldContext && history.length > 0) {
    // Find first user message and prepend context
    const firstUserIndex = history.findIndex(m => m.role === 'user')
    if (firstUserIndex >= 0) {
      return history.map((msg, index) => {
        if (index === firstUserIndex) {
          return {
            role: 'user',
            content: `${worldContext}\n\n---\n\n${msg.content}`
          }
        }
        return msg
      })
    }
  }

  return history
}

/**
 * Summarize conversation for context window management
 *
 * @param {Array} history - Full conversation history
 * @param {number} maxMessages - Maximum messages to keep
 * @returns {Array} Trimmed history
 */
export function summarizeHistory(history, maxMessages = 20) {
  if (history.length <= maxMessages) {
    return history
  }

  // Keep system message and recent messages
  const recent = history.slice(-maxMessages)

  // Add a summary of older messages
  const older = history.slice(0, -maxMessages)
  if (older.length > 0) {
    const summary = `[Earlier in this conversation: ${older.length} messages about world building were exchanged.]`
    return [
      { role: 'user', content: summary },
      { role: 'assistant', content: 'Understood. I have context from our earlier discussion.' },
      ...recent
    ]
  }

  return recent
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) return str || ''
  return str.slice(0, maxLength - 3) + '...'
}

export default {
  buildSystemPrompt,
  buildWorldContext,
  buildMessages,
  summarizeHistory
}
