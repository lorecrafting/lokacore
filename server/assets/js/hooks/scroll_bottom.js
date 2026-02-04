// Auto-scroll to bottom on content updates (for chat panels)
const ScrollBottom = {
  mounted() {
    this.scrollToBottom()
  },
  updated() {
    this.scrollToBottom()
  },
  scrollToBottom() {
    this.el.scrollTop = this.el.scrollHeight
  },
  destroyed() {
    // No resources to clean up (LiveView manages handleEvent bindings)
  }
}

export default ScrollBottom
