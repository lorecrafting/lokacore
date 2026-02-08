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
 *   - clear_terminal -- server-initiated clear
 *
 * @related
 *   - lib/loka_web/channels/game_channel.ex (server-side channel)
 *   - assets/css/world-builder/terminal.css (styling)
 *   - lib/loka_web/live/admin_live/world_builder/terminal_panel.ex (LiveView component)
 * @used_by WorldBuilderLive terminal panel
 */

import { Socket } from 'phoenix'
import { HookHelper } from '../world_builder/HookHelper.js'

const MAX_TERMINAL_LINES = 1000

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

      this.setConnectionState('connecting')

      if (!this.token) {
        this.appendOutput('No auth token available.', 'error')
        this.setConnectionState('disconnected')
        return
      }

      this.connect()

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
              const now = Date.now()
              if (now - this._lastCommandTime < 200) return
              this._lastCommandTime = now
              this.appendOutput(`> ${input}`, 'system')
              this.commandHistory.push(input)
              this.historyIndex = this.commandHistory.length
              this.channel.push('command', { input })
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
          this.appendOutput('Visit /character/create to create your character.', 'system')
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
        this.appendRoomDescription(data.room, data.atmosphere)
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
      if (data.text) this.appendOutput(data.text, 'chat')
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

    // Inventory updates
    this.channel.on('inventory_update', (data) => {
      if (data.text) this.appendOutput(data.text, 'system')
    })

    // Clear terminal
    this.channel.on('clear_terminal', () => {
      this.clearOutput()
    })
  },

  appendOutput(text, className = '') {
    const lines = text.split('\n')
    lines.forEach((line) => {
      const div = document.createElement('div')
      div.className = `terminal-line${className ? ` ${className}` : ''}`
      div.textContent = line
      this.outputEl.appendChild(div)
    })

    // Prune oldest lines to prevent unbounded DOM growth
    while (this.outputEl.children.length > MAX_TERMINAL_LINES) {
      this.outputEl.removeChild(this.outputEl.firstChild)
    }

    this.outputEl.scrollTop = this.outputEl.scrollHeight
  },

  appendRoomDescription(room, atmosphere) {
    this.appendOutput('')
    this.appendOutput(room.title || room.name, 'room-title')
    this.appendOutput('-'.repeat((room.title || room.name || '').length))
    if (atmosphere) {
      this.appendOutput(atmosphere, 'emote')
    }
    this.appendOutput('')
    this.appendOutput(room.description || '')
    this.appendOutput('')

    // Entities
    const entities = room.entities || []
    entities.forEach((e) => {
      this.appendOutput(`${e.name} is here.`)
    })

    // Items
    const items = room.items || []
    items.forEach((i) => {
      this.appendOutput(`${i.name} lies on the ground.`)
    })

    // Exits
    const exits = (room.exits || []).filter((e) => e.destination_id).map((e) => e.direction)
    this.appendOutput('')
    this.appendOutput(`Exits: ${exits.length ? exits.join(', ') : 'none'}`)
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
        this.appendOutput(`  [${i + 1}] ${choice.text || choice}`, 'system')
      })
      this.appendOutput('(Type a number to choose)', 'system')
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

  updated() {
    // Refresh DOM references that may have been replaced by LiveView patches
    if (!this.terminalContainer) return
    this.inputEl = this.terminalContainer.querySelector('#terminal-command-input')
    this.hpEl = this.terminalContainer.querySelector('#term-hp')
    this.maEl = this.terminalContainer.querySelector('#term-ma')
    this.mvEl = this.terminalContainer.querySelector('#term-mv')
    this.exitsEl = this.terminalContainer.querySelector('#term-exits')
    this.statusDot = this.terminalContainer.querySelector('#term-connection-dot')
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
