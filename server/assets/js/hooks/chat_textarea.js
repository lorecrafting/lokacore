// Chat textarea with Ctrl+Enter submit support
const ChatTextarea = {
  mounted() {
    this.keydownHandler = (e) => {
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
    }
    this.el.addEventListener('keydown', this.keydownHandler)
  },

  destroyed() {
    if (this.keydownHandler) {
      this.el.removeEventListener('keydown', this.keydownHandler)
    }
  }
}

export default ChatTextarea
