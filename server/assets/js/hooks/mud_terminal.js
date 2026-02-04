import {Socket} from "phoenix"

// MUD Terminal hook - connects to GameChannel for in-editor MUD testing
const MudTerminal = {
  mounted() {
    this.token = this.el.dataset.token
    this.commandHistory = []
    this.historyIndex = -1
    this.socket = null
    this.channel = null

    // DOM elements
    this.outputEl = this.el
    this.inputEl = document.getElementById('terminal-command-input')
    this.hpEl = document.getElementById('term-hp')
    this.maEl = document.getElementById('term-ma')
    this.mvEl = document.getElementById('term-mv')
    this.exitsEl = document.getElementById('term-exits')
    this.statusDot = document.getElementById('term-connection-dot')

    this.setConnectionState('connecting')

    if (!this.token) {
      this.appendOutput('No auth token available.', 'error')
      this.setConnectionState('disconnected')
      return
    }

    this.connect()

    // Input handling
    if (this.inputEl) {
      this.inputHandler = (e) => {
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
      }
      this.inputEl.addEventListener('keydown', this.inputHandler)
    }
  },

  setConnectionState(state) {
    // state: 'connecting', 'connected', 'disconnected'
    if (this.statusDot) {
      this.statusDot.className = 'term-connection-dot ' + state
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

    this.channel.join()
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
      const cls = data.type === 'emergency' ? 'error' :
                  data.type === 'event' ? 'chat' : 'system'
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
    lines.forEach(line => {
      const div = document.createElement('div')
      div.className = 'terminal-line' + (className ? ` ${className}` : '')
      div.textContent = line
      this.outputEl.appendChild(div)
    })
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
    entities.forEach(e => {
      this.appendOutput(`${e.name} is here.`)
    })

    // Items
    const items = room.items || []
    items.forEach(i => {
      this.appendOutput(`${i.name} lies on the ground.`)
    })

    // Exits
    const exits = (room.exits || []).filter(e => e.destination_id).map(e => e.direction)
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
    const dirs = (exits || []).filter(e => e.destination_id).map(e => e.direction)
    if (this.exitsEl) this.exitsEl.textContent = `Exits: ${dirs.length ? dirs.join(', ') : 'none'}`
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
    if (this.inputEl && this.inputHandler) {
      this.inputEl.removeEventListener('keydown', this.inputHandler)
    }
  }
}

export default MudTerminal
