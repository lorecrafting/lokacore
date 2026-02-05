// Auto-scroll to bottom on content updates (for chat panels)
const ScrollBottom = {
  mounted() {
    try {
      this.scrollToBottom()
    } catch (err) {
      console.error('[ScrollBottom] Failed to initialize:', err)
    }
  },
  updated() {
    try {
      this.scrollToBottom()
    } catch (err) {
      console.error('[ScrollBottom] Failed to scroll on update:', err)
    }
  },
  scrollToBottom() {
    if (!this.el) {
      console.warn('[ScrollBottom] Element not found')
      return
    }
    this.el.scrollTop = this.el.scrollHeight
  },
  destroyed() {
    // No resources to clean up (LiveView manages handleEvent bindings)
  },
}

export default ScrollBottom
