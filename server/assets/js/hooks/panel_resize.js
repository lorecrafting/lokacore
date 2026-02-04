// Panel Resize - Handles draggable panel dividers
const PanelResize = {
  mounted() {
    this.container = this.el
    this.handles = this.el.querySelectorAll('.panel-resize-handle, .console-resize-handle')
    this.isDragging = false
    this.currentHandle = null
    this.startX = 0
    this.startY = 0
    this.startSize = 0

    // Load saved sizes from localStorage
    this.loadSavedSizes()

    // Bind drag handlers
    this.handleMouseDown = this.handleMouseDown.bind(this)
    this.handleMouseMove = this.handleMouseMove.bind(this)
    this.handleMouseUp = this.handleMouseUp.bind(this)

    // Attach listeners to all resize handles
    this.handles.forEach(handle => {
      handle.addEventListener('mousedown', this.handleMouseDown)
    })

    // Global mouse events for dragging
    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('mouseup', this.handleMouseUp)
  },

  loadSavedSizes() {
    try {
      const saved = localStorage.getItem('world-builder-panel-sizes')
      if (saved) {
        const sizes = JSON.parse(saved)
        // Apply saved sizes via LiveView event
        Object.entries(sizes).forEach(([panel, size]) => {
          this.pushEvent('resize_panel', { panel, size })
        })
      }
    } catch (e) {
      console.warn('Failed to load saved panel sizes:', e)
    }
  },

  saveSizes(panel, size) {
    try {
      const saved = localStorage.getItem('world-builder-panel-sizes')
      const sizes = saved ? JSON.parse(saved) : {}
      sizes[panel] = size
      localStorage.setItem('world-builder-panel-sizes', JSON.stringify(sizes))
    } catch (e) {
      console.warn('Failed to save panel sizes:', e)
    }
  },

  handleMouseDown(e) {
    e.preventDefault()
    this.isDragging = true
    this.currentHandle = e.target
    this.currentHandle.classList.add('dragging')
    this.startX = e.clientX
    this.startY = e.clientY

    const panel = this.currentHandle.dataset.resize

    if (panel === 'console') {
      // Get current console height
      const consoleEl = this.container.querySelector('.world-builder-console')
      this.startSize = consoleEl ? consoleEl.offsetHeight : 150
    } else if (panel === 'hierarchy') {
      const hierarchyEl = this.container.querySelector('.world-builder-hierarchy')
      this.startSize = hierarchyEl ? hierarchyEl.offsetWidth : 200
    } else if (panel === 'inspector') {
      const inspectorEl = this.container.querySelector('.world-builder-inspector')
      this.startSize = inspectorEl ? inspectorEl.offsetWidth : 260
    } else if (panel === 'terminal') {
      const terminalEl = this.container.querySelector('.world-builder-terminal')
      this.startSize = terminalEl ? terminalEl.offsetWidth : 320
    } else if (panel === 'chat') {
      const chatEl = this.container.querySelector('.world-builder-chat')
      this.startSize = chatEl ? chatEl.offsetWidth : 320
    }

    // Add no-select class to prevent text selection during drag
    document.body.style.userSelect = 'none'
    document.body.style.cursor = panel === 'console' ? 'row-resize' : 'col-resize'
  },

  handleMouseMove(e) {
    if (!this.isDragging || !this.currentHandle) return

    const panel = this.currentHandle.dataset.resize
    let newSize

    if (panel === 'console') {
      // Console resizes vertically (drag up = bigger)
      const delta = this.startY - e.clientY
      newSize = Math.max(80, Math.min(400, this.startSize + delta))
    } else if (panel === 'hierarchy') {
      // Hierarchy resizes from right edge
      const delta = e.clientX - this.startX
      newSize = Math.max(150, Math.min(400, this.startSize + delta))
    } else if (panel === 'inspector') {
      // Inspector resizes from left edge (drag left = bigger)
      const delta = this.startX - e.clientX
      newSize = Math.max(200, Math.min(500, this.startSize + delta))
    } else if (panel === 'terminal') {
      // Terminal resizes from left edge (drag left = bigger)
      const delta = this.startX - e.clientX
      newSize = Math.max(200, Math.min(500, this.startSize + delta))
    } else if (panel === 'chat') {
      // Chat resizes from left edge (drag left = bigger)
      const delta = this.startX - e.clientX
      newSize = Math.max(200, Math.min(500, this.startSize + delta))
    }

    // Update via LiveView
    this.pushEvent('resize_panel', { panel, size: Math.round(newSize) })
  },

  handleMouseUp() {
    if (this.isDragging && this.currentHandle) {
      this.currentHandle.classList.remove('dragging')
      const panel = this.currentHandle.dataset.resize

      // Get final size and save
      let finalSize
      if (panel === 'console') {
        const el = this.container.querySelector('.world-builder-console')
        finalSize = el ? el.offsetHeight : 150
      } else if (panel === 'hierarchy') {
        const el = this.container.querySelector('.world-builder-hierarchy')
        finalSize = el ? el.offsetWidth : 200
      } else if (panel === 'inspector') {
        const el = this.container.querySelector('.world-builder-inspector')
        finalSize = el ? el.offsetWidth : 260
      } else if (panel === 'terminal') {
        const el = this.container.querySelector('.world-builder-terminal')
        finalSize = el ? el.offsetWidth : 320
      } else if (panel === 'chat') {
        const el = this.container.querySelector('.world-builder-chat')
        finalSize = el ? el.offsetWidth : 320
      }

      this.saveSizes(panel, finalSize)
    }

    this.isDragging = false
    this.currentHandle = null
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  },

  destroyed() {
    this.handles.forEach(handle => {
      handle.removeEventListener('mousedown', this.handleMouseDown)
    })
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mouseup', this.handleMouseUp)
  }
}

export default PanelResize
