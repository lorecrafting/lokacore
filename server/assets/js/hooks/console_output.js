// Console Output hook for export functionality
const ConsoleOutput = {
  mounted() {
    this.handleEvent("download_text", ({content, filename}) => {
      const blob = new Blob([content], {type: 'text/plain'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  },
  destroyed() {
    // No resources to clean up (LiveView manages handleEvent bindings)
  }
}

export default ConsoleOutput
