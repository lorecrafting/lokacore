import { HookHelper } from '../world_builder/HookHelper.js'

// Chat textarea with Ctrl+Enter submit support
const ChatTextarea = {
  mounted() {
    try {
      this.helper = new HookHelper(this)

      if (!this.el) {
        console.warn('[ChatTextarea] Element not found')
        return
      }

      this.helper.on(this.el, 'keydown', (e) => {
        // Ctrl+Enter or Cmd+Enter to submit
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          const form = this.el.closest('form')
          if (form && this.el.value.trim()) {
            // Trigger LiveView form submit
            this.pushEvent('send_message', { message: this.el.value })
            this.el.value = ''
          }
        }
      })
    } catch (err) {
      console.error('[ChatTextarea] Failed to initialize:', err)
    }
  },

  destroyed() {
    if (this.helper) this.helper.destroy()
  },
}

export default ChatTextarea
