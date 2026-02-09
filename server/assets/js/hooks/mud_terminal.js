/**
 * @file mud_terminal.js - Phoenix Channel connection for in-editor MUD testing
 *
 * LLM CONTEXT:
 * - Uses Phoenix Channels (WebSocket), NOT LiveView pushEvent/handleEvent
 * - Token for auth is read from this.el.dataset.token (set by LiveView template)
 * - DOM queries are scoped to terminalContainer, NOT document (supports multiple instances)
 * - Command history is JS-local, not persisted (commandHistory array, historyIndex counter)
 * - "clear" command is handled client-side (no server roundtrip)
 * - MAX_TERMINAL_LINES (1000) limits DOM growth -- oldest lines are pruned
 * - Connection state shown via CSS class on statusDot element (connecting/connected/disconnected)
 * - e.stopPropagation() on input keydown prevents WorldBuilder shortcuts from firing
 *
 * DO NOT:
 * - Use pushEvent/handleEvent -- this hook uses Phoenix Channels
 * - Query DOM globally with document.querySelector (scope to terminalContainer)
 * - Forget to leave channel and disconnect socket in destroyed()
 * - Append to terminal without pruning (will cause memory issues)
 *
 * CHANNEL EVENTS (Phoenix Channel, NOT LiveView):
 * channel.push (JS -> Server):
 *   - 'command' { input } -- user entered a command
 *   - 'click_entity' { entity_id } -- interact with entity (reuses game client flow)
 *
 * channel.on (Server -> JS):
 *   - game_state -- initial state on join (room, health, resources)
 *   - room_update -- navigation, look command results
 *   - output -- text responses from commands
 *   - event -- game events (chat messages, etc.)
 *   - resources_update -- mana/mv changes
 *   - broadcast -- server announcements
 *   - combat_start, combat_update, combat_end -- combat system
 *   - dialogue_start, dialogue_update, dialogue_end -- NPC conversations
 *   - inventory_update -- item changes
 *   - entity_context -- entity click response (name, description, actions)
 *   - clear_terminal -- server-initiated clear
 *
 * @related
 *   - lib/loka_web/channels/game_channel.ex (server-side channel)
 *   - assets/css/builder/terminal.css (styling)
 *   - lib/loka_web/live/admin_live/builder_live.ex (LiveView page)
 * @used_by BuilderLive terminal panel
 */

import { Socket } from 'phoenix'
import { HookHelper } from './HookHelper.js'
import { parseMarkupSegments } from './terminalMarkup.js'

const MAX_TERMINAL_LINES = 1000

/** Converts parseMarkupSegments output into a DocumentFragment with clickable spans. */
function segmentsToFragment(segments) {
  const frag = document.createDocumentFragment()
  for (const seg of segments) {
    if (seg.type === 'text') {
      frag.appendChild(document.createTextNode(seg.value))
    } else {
      const span = document.createElement('span')
      span.className = 'term-link'
      span.dataset.cmd = seg.cmd
      span.textContent = seg.text
      frag.appendChild(span)
    }
  }
  return frag
}

const MudTerminal = {
  mounted() {
    try {
      this.helper = new HookHelper(this)
      this.token = this.el.dataset.token
      this.commandHistory = []
      this.historyIndex = -1
      this._lastCommandTime = 0
      this.socket = null
      this.channel = null
      this._aiStreamBuffer = ''

      // Scope DOM queries to terminal container instead of global document
      this.terminalContainer = this.el.closest('.world-builder-terminal') || this.el.parentElement
      if (!this.terminalContainer) {
        console.warn('[MudTerminal] Terminal container not found')
        return
      }

      this.outputEl = this.el
      this.inputEl = this.terminalContainer.querySelector('#terminal-command-input')
      this.hpEl = this.terminalContainer.querySelector('#term-hp')
      this.maEl = this.terminalContainer.querySelector('#term-ma')
      this.mvEl = this.terminalContainer.querySelector('#term-mv')
      this.exitsEl = this.terminalContainer.querySelector('#term-exits')
      this.statusDot = this.terminalContainer.querySelector('#term-connection-dot')
      this.modeEl = this.terminalContainer.querySelector('#term-mode')

      this.setConnectionState('connecting')

      if (!this.token) {
        this.appendOutput('No auth token available.', 'error')
        this.setConnectionState('disconnected')
        return
      }

      this.connect()

      // Delegated click handler for .term-link elements in terminal output
      this.helper.on(this.outputEl, 'click', (e) => {
        const link = e.target.closest('.term-link')
        if (!link) return

        const entityId = link.dataset.entityId
        if (entityId) {
          this.channel.push('click_entity', { entity_id: entityId })
          return
        }

        const choiceIndex = link.dataset.choiceIndex
        if (choiceIndex != null) {
          this.appendOutput(`> [${link.textContent.trim()}]`, 'system')
          this.channel.push('dialogue_select', { choice_index: parseInt(choiceIndex, 10) })
          return
        }

        const cmd = link.dataset.cmd
        if (cmd) {
          this.sendCommand(cmd)
        }
      })

      // Input handling
      if (this.inputEl) {
        this.helper.on(this.inputEl, 'keydown', (e) => {
          // Prevent World Builder keyboard shortcuts from firing when typing
          e.stopPropagation()

          if (e.key === 'Enter') {
            const input = this.inputEl.value.trim()
            if (input) {
              // Handle clear client-side (no server round-trip needed)
              if (input.toLowerCase() === 'clear') {
                this.commandHistory.push(input)
                this.historyIndex = this.commandHistory.length
                this.clearOutput()
                this.inputEl.value = ''
                return
              }
              this.sendCommand(input)
              this.inputEl.value = ''
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (this.historyIndex > 0) {
              this.historyIndex--
              this.inputEl.value = this.commandHistory[this.historyIndex]
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (this.historyIndex < this.commandHistory.length - 1) {
              this.historyIndex++
              this.inputEl.value = this.commandHistory[this.historyIndex]
            } else {
              this.historyIndex = this.commandHistory.length
              this.inputEl.value = ''
            }
          }
        })
      }
    } catch (err) {
      console.error('[MudTerminal] Failed to initialize:', err)
    }
  },

  setConnectionState(state) {
    // state: 'connecting', 'connected', 'disconnected'
    if (this.statusDot) {
      this.statusDot.className = `term-connection-dot ${state}`
      this.statusDot.title = state.charAt(0).toUpperCase() + state.slice(1)
    }
  },

  clearOutput() {
    this.outputEl.innerHTML = ''
  },

  sendCommand(input) {
    const now = Date.now()
    if (now - this._lastCommandTime < 200) return
    this._lastCommandTime = now
    this.appendOutput(`> ${input}`, 'system')
    this.commandHistory.push(input)
    this.historyIndex = this.commandHistory.length
    this.channel.push('command', { input })
  },

  parseMarkup(text) {
    return segmentsToFragment(parseMarkupSegments(text))
  },

  connect() {
    this.setConnectionState('connecting')

    // Use the Phoenix Socket from the same module
    this.socket = new Socket('/socket', { params: { token: this.token } })
    this.socket.connect()

    // Track socket-level connection state
    this.socket.onError(() => this.setConnectionState('disconnected'))
    this.socket.onClose(() => this.setConnectionState('disconnected'))

    this.channel = this.socket.channel('game:lobby', {})

    this.channel
      .join()
      .receive('ok', () => {
        this.setConnectionState('connected')
        this.appendOutput('Connected to Loka.', 'system')
        this.appendOutput('Type "help" for available commands.', 'system')
        this.appendOutput('', 'system')
      })
      .receive('error', (resp) => {
        this.setConnectionState('disconnected')
        if (resp.reason === 'character_not_created') {
          this.appendOutput('You need to create a character first.', 'error')
          this.appendOutput('Please set up a character through the game client.', 'system')
        } else {
          this.appendOutput(`Connection failed: ${resp.reason || 'unknown'}`, 'error')
        }
      })

    this.channel.onClose(() => this.setConnectionState('disconnected'))
    this.channel.onError(() => this.setConnectionState('disconnected'))

    // Game state (on join)
    this.channel.on('game_state', (state) => {
      this.updateVitals(state)
      if (state.room) {
        this.updateExits(state.room.exits)
        this.appendRoomDescription(state.room, state.atmosphere)
      }
    })

    // Room updates (navigation, look)
    this.channel.on('room_update', (data) => {
      if (data.room) {
        this.updateExits(data.room.exits)
        this.appendRoomDescription(data.room, data.atmosphere, data.minimap)
      }
    })

    // Text output (command responses, builder output)
    this.channel.on('output', (data) => {
      if (data.text) {
        const cls = data.text.startsWith('[BUILDER]') ? 'builder' : ''
        this.appendOutput(data.text, cls)
      }
    })

    // Game events
    this.channel.on('event', (data) => {
      if (data.text) {
        const cls = data.type === 'ambient' ? 'ambient' : 'chat'
        this.appendOutput(data.text, cls)
      }
    })

    // Resource updates
    this.channel.on('resources_update', (data) => {
      this.updateResources(data.resources)
    })

    // Broadcast messages
    this.channel.on('broadcast', (data) => {
      let cls = 'system'
      if (data.type === 'emergency') {
        cls = 'error'
      } else if (data.type === 'event') {
        cls = 'chat'
      }
      if (data.text) this.appendOutput(data.text, cls)
    })

    // Combat events
    this.channel.on('combat_start', (data) => {
      this.appendOutput(`Combat started with ${data.enemy?.name || 'enemy'}!`, 'error')
    })

    this.channel.on('combat_update', (data) => {
      if (data.text) this.appendOutput(data.text, 'chat')
      if (data.health) {
        this.hpEl.textContent = `${data.health.current}/${data.health.max}`
      }
    })

    this.channel.on('combat_end', (data) => {
      this.appendOutput(data.text || 'Combat ended.', 'system')
    })

    // Dialogue events
    this.channel.on('dialogue_start', (data) => {
      this.renderDialogue(data)
    })

    this.channel.on('dialogue_update', (data) => {
      this.renderDialogue(data)
    })

    this.channel.on('dialogue_end', () => {
      this.appendOutput('(Conversation ended)', 'system')
    })

    // Entity context (response to click_entity - shows description + action menu)
    this.channel.on('entity_context', (data) => {
      const entity = data.entity
      if (!entity) return

      this.appendOutput('')
      this.appendOutput(entity.name, 'room-title')
      if (entity.long_desc || entity.description) {
        this.appendOutput(`  ${entity.long_desc || entity.description}`)
      }

      const actions = entity.actions || []
      if (actions.length > 0) {
        const keyword = entity.primary_keyword || entity.name?.toLowerCase()
        const div = document.createElement('div')
        div.className = 'terminal-line term-actions'
        div.appendChild(document.createTextNode('  '))
        actions.forEach((action, idx) => {
          if (idx > 0) div.appendChild(document.createTextNode('  '))
          const link = document.createElement('span')
          link.className = 'term-link'
          link.dataset.cmd = `${action.key} ${keyword}`
          link.textContent = `[${action.label}]`
          div.appendChild(link)
        })
        this.outputEl.appendChild(div)
        this.pruneAndScroll()
      }
    })

    // Inventory updates
    this.channel.on('inventory_update', (data) => {
      if (data.text) this.appendOutput(data.text, 'system')
    })

    // Clear terminal
    this.channel.on('clear_terminal', () => {
      this.clearOutput()
    })

    // =========================================================================
    // AI Streaming Events (Builder AI + Spark)
    // =========================================================================

    // AI text streaming - accumulate into current line, flush on newlines
    this.channel.on('ai_stream_delta', (data) => {
      if (!data.text) return
      this._aiStreamBuffer += data.text

      // Flush complete lines
      const lines = this._aiStreamBuffer.split('\n')
      if (lines.length > 1) {
        // Output all complete lines (all but the last)
        for (let i = 0; i < lines.length - 1; i++) {
          this.appendOutput(lines[i], 'ai')
        }
        // Keep the incomplete last line in buffer
        this._aiStreamBuffer = lines[lines.length - 1]
      }
    })

    // AI tool execution (verbose mode - shows tool calls inline)
    this.channel.on('ai_stream_tool', (data) => {
      const name = data.name || 'unknown'
      const summary = data.summary || name
      this.appendOutput(`  [tool] ${summary}`, 'ai-tool')
    })

    // AI stream complete - flush remaining buffer
    this.channel.on('ai_stream_done', () => {
      if (this._aiStreamBuffer) {
        this.appendOutput(this._aiStreamBuffer, 'ai')
        this._aiStreamBuffer = ''
      }
    })

    // AI stream error
    this.channel.on('ai_stream_error', (data) => {
      this._aiStreamBuffer = ''
      const msg = data.error || 'AI request failed'
      this.appendOutput(`[AI Error] ${msg}`, 'error')
    })

    // Chat mode toggle (NORMAL ↔ CHAT)
    this.channel.on('chat_mode_changed', (data) => {
      const mode = data.mode || 'normal'
      this.setMode(mode)
    })
  },

  appendOutput(text, className = '') {
    const lines = text.split('\n')
    lines.forEach((line) => {
      const div = document.createElement('div')
      div.className = `terminal-line${className ? ` ${className}` : ''}`
      if (line.includes('{{cmd:')) {
        div.appendChild(this.parseMarkup(line))
      } else {
        div.textContent = line
      }
      this.outputEl.appendChild(div)
    })

    // Prune oldest lines to prevent unbounded DOM growth
    while (this.outputEl.children.length > MAX_TERMINAL_LINES) {
      this.outputEl.removeChild(this.outputEl.firstChild)
    }

    this.outputEl.scrollTop = this.outputEl.scrollHeight
  },

  appendRoomDescription(room, atmosphere, minimap) {
    this.appendOutput('')
    this.appendOutput(room.title || room.name, 'room-title')
    this.appendOutput('-'.repeat((room.title || room.name || '').length))
    if (atmosphere) {
      this.appendOutput(atmosphere, 'emote')
    }
    this.appendOutput('')
    this.appendOutput(room.description || '')
    this.appendOutput('')

    // Entities - clickable long_desc (room-presence description)
    const entities = room.entities || []
    entities.forEach((e) => {
      const div = document.createElement('div')
      div.className = 'terminal-line'
      const link = document.createElement('span')
      link.className = 'term-link'
      link.dataset.entityId = e.id
      link.textContent = e.long_desc || `${e.name} is here.`
      div.appendChild(link)
      this.outputEl.appendChild(div)
    })

    // Items - clickable names that send click_entity
    const items = room.items || []
    items.forEach((i) => {
      const div = document.createElement('div')
      div.className = 'terminal-line'
      const link = document.createElement('span')
      link.className = 'term-link'
      link.dataset.entityId = i.id
      link.textContent = i.name
      div.appendChild(link)
      div.appendChild(document.createTextNode(' lies on the ground.'))
      this.outputEl.appendChild(div)
    })

    // Exits - clickable directions that navigate
    const exits = (room.exits || []).filter((e) => e.destination_id)
    this.appendOutput('')
    if (exits.length) {
      const div = document.createElement('div')
      div.className = 'terminal-line'
      div.appendChild(document.createTextNode('Exits: '))
      exits.forEach((exit, idx) => {
        if (idx > 0) div.appendChild(document.createTextNode(', '))
        const link = document.createElement('span')
        link.className = 'term-link'
        link.dataset.cmd = exit.direction
        link.textContent = exit.direction
        div.appendChild(link)
      })
      this.outputEl.appendChild(div)
    } else {
      this.appendOutput('Exits: none')
    }

    // Minimap - compact spatial map after exits
    if (minimap) {
      this.appendOutput('')
      this.appendOutput(minimap)
    }

    this.pruneAndScroll()
  },

  /** Prune old lines and scroll to bottom. Called after manual DOM appends. */
  pruneAndScroll() {
    while (this.outputEl.children.length > MAX_TERMINAL_LINES) {
      this.outputEl.removeChild(this.outputEl.firstChild)
    }
    this.outputEl.scrollTop = this.outputEl.scrollHeight
  },

  renderDialogue(data) {
    if (data.npc_name) {
      this.appendOutput(`${data.npc_name} says:`, 'chat')
    }
    if (data.text) {
      this.appendOutput(data.text, 'chat')
    }
    if (data.choices && data.choices.length > 0) {
      this.appendOutput('')
      data.choices.forEach((choice, i) => {
        const text = choice.text || choice
        const div = document.createElement('div')
        div.className = 'terminal-line system'
        const link = document.createElement('span')
        link.className = 'term-link'
        link.dataset.choiceIndex = i
        link.textContent = `  [${i + 1}] ${text}`
        div.appendChild(link)
        this.outputEl.appendChild(div)
      })
      this.appendOutput('(Type a number or click to choose)', 'system')
      this.pruneAndScroll()
    }
  },

  updateVitals(state) {
    const health = state.health || { current: 100, max: 100 }
    const resources = state.resources || {}
    const mana = resources.mana || { current: 100, max: 100 }
    const mv = resources.mv || { current: 150, max: 150 }

    if (this.hpEl) this.hpEl.textContent = `${health.current}/${health.max}`
    if (this.maEl) this.maEl.textContent = `${mana.current}/${mana.max}`
    if (this.mvEl) this.mvEl.textContent = `${mv.current}/${mv.max}`
  },

  updateResources(resources) {
    if (!resources) return
    const mana = resources.mana || { current: 100, max: 100 }
    const mv = resources.mv || { current: 150, max: 150 }
    if (this.maEl) this.maEl.textContent = `${mana.current}/${mana.max}`
    if (this.mvEl) this.mvEl.textContent = `${mv.current}/${mv.max}`
  },

  updateExits(exits) {
    const dirs = (exits || []).filter((e) => e.destination_id).map((e) => e.direction)
    if (this.exitsEl) this.exitsEl.textContent = `Exits: ${dirs.length ? dirs.join(', ') : 'none'}`
  },

  setMode(mode) {
    if (this.modeEl) {
      const label = mode === 'chat' ? 'CHAT' : 'NORMAL'
      this.modeEl.textContent = label
      this.modeEl.className = mode === 'chat' ? 'text-warning font-medium' : 'text-primary font-medium'
    }
  },

  updated() {
    // Refresh DOM references that may have been replaced by LiveView patches
    if (!this.terminalContainer) return
    this.inputEl = this.terminalContainer.querySelector('#terminal-command-input')
    this.hpEl = this.terminalContainer.querySelector('#term-hp')
    this.maEl = this.terminalContainer.querySelector('#term-ma')
    this.mvEl = this.terminalContainer.querySelector('#term-mv')
    this.exitsEl = this.terminalContainer.querySelector('#term-exits')
    this.statusDot = this.terminalContainer.querySelector('#term-connection-dot')
    this.modeEl = this.terminalContainer.querySelector('#term-mode')
  },

  destroyed() {
    if (this.channel) {
      this.channel.leave()
      this.channel = null
    }
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    if (this.helper) this.helper.destroy()
  },
}

export default MudTerminal
