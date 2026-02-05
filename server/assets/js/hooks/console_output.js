// Console Output hook for export functionality
const ConsoleOutput = {
  mounted() {
    try {
      this.handleEvent('download_text', ({ content, filename }) => {
        try {
          const blob = new Blob([content], { type: 'text/plain' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        } catch (downloadErr) {
          console.error('[ConsoleOutput] Failed to download file:', downloadErr)
        }
      })
    } catch (err) {
      console.error('[ConsoleOutput] Failed to initialize:', err)
    }
  },
  destroyed() {
    // No resources to clean up (LiveView manages handleEvent bindings)
  },
}

export default ConsoleOutput
