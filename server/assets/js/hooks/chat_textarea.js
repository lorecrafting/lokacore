import { HookHelper } from '../world_builder/HookHelper.js'

// Chat textarea with Enter submit, Shift+Enter for newline
const ChatTextarea = {
  mounted() {
    try {
      this.helper = new HookHelper(this)

      if (!this.el) {
        console.warn('[ChatTextarea] Element not found')
        return
      }

      this.helper.on(this.el, 'keydown', (e) => {
        // Enter to submit (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const form = this.el.closest('form')
          if (form && this.el.value.trim()) {
            this.pushEvent('send_message', { message: this.el.value })
            this.el.value = ''
          }
        }
        // Shift+Enter falls through naturally for newline
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
