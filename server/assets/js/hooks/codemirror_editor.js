const DEBOUNCE_MS = 300

// CodeMirror 6 - Elixir script editor
// Uses dynamic import() so CodeMirror is code-split into a separate chunk
// and only loaded when the script editor is actually opened.
const CodeMirrorEditor = {
  async mounted() {
    try {
      // Show loading state while CodeMirror loads
      if (!this.el) {
        console.warn('[CodeMirrorEditor] Element not found')
        return
      }
      this.el.style.opacity = '0.5'
      const [
        {
          EditorView,
          lineNumbers,
          highlightActiveLine,
          highlightSpecialChars,
          drawSelection,
          dropCursor,
          keymap,
        },
        { history, defaultKeymap, historyKeymap },
        {
          syntaxHighlighting,
          defaultHighlightStyle,
          bracketMatching,
          indentOnInput,
          StreamLanguage,
        },
        { closeBrackets, closeBracketsKeymap },
        { highlightSelectionMatches },
        { oneDark },
      ] = await Promise.all([
        import('@codemirror/view'),
        import('@codemirror/commands'),
        import('@codemirror/language'),
        import('@codemirror/autocomplete'),
        import('@codemirror/search'),
        import('@codemirror/theme-one-dark'),
      ])

      // Bail if destroyed while loading
      if (this._destroyed) return

      // Define Elixir-like tokenizer via StreamLanguage
      const elixirLang = StreamLanguage.define({
        startState() {
          return { inString: false, stringChar: null }
        },
        token(stream, state) {
          if (stream.eatSpace()) return null

          // Comments
          if (stream.match('#')) {
            stream.skipToEnd()
            return 'comment'
          }

          // Strings
          if (stream.match('"""') || stream.match("'''")) {
            stream.skipTo(stream.current()) || stream.skipToEnd()
            return 'string'
          }
          if (stream.match(/"[^"]*"/) || stream.match(/'[^']*'/)) return 'string'
          if (stream.match('"') || stream.match("'")) {
            const ch = stream.current()
            while (!stream.eol()) {
              const next = stream.next()
              if (next === ch) break
            }
            return 'string'
          }

          // Atoms
          if (stream.match(/:[a-zA-Z_][a-zA-Z0-9_]*/)) return 'atom'

          // Module attributes
          if (stream.match(/@[a-z_][a-z0-9_]*/)) return 'meta'

          // Numbers
          if (
            stream.match(/0x[0-9a-fA-F]+/) ||
            stream.match(/0b[01]+/) ||
            stream.match(/\d+(\.\d+)?/)
          )
            return 'number'

          // Keywords
          if (
            stream.match(
              /\b(def|defp|defmodule|defmacro|defstruct|defprotocol|defimpl|do|end|if|else|unless|case|cond|when|and|or|not|in|fn|with|for|raise|try|catch|rescue|after|receive|send|import|alias|require|use|true|false|nil)\b/
            )
          )
            return 'keyword'

          // Identifiers with ! or ?
          if (stream.match(/[a-z_][a-z0-9_]*[!?]?/)) return 'variableName'

          // Module names (capitalized)
          if (stream.match(/[A-Z][a-zA-Z0-9_]*/)) return 'typeName'

          // Operators
          if (stream.match(/->|<-|\|>|=>|::|&&|\|\||==|!=|<=|>=|=~|\+\+|--|\.\./)) return 'operator'

          stream.next()
          return null
        },
      })

      const initialValue = this.el.dataset.value || ''
      this._debounceTimer = null

      this.view = new EditorView({
        doc: initialValue,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightSelectionMatches(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
          elixirLang,
          oneDark,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              clearTimeout(this._debounceTimer)
              this._debounceTimer = setTimeout(() => {
                this.pushEvent('script_source_changed', {
                  source: update.state.doc.toString(),
                })
              }, DEBOUNCE_MS)
            }
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '13px' },
            '.cm-scroller': { overflow: 'auto' },
            '.cm-content': { fontFamily: 'ui-monospace, monospace' },
          }),
        ],
        parent: this.el,
      })

      // Remove loading state
      this.el.style.opacity = ''
    } catch (err) {
      console.error('[CodeMirrorEditor] Failed to initialize:', err)
      if (this.el) {
        this.el.style.opacity = '1'
        this.el.innerHTML =
          '<div class="p-4 text-red-400">Failed to load code editor. Try refreshing.</div>'
      }
    }
  },

  destroyed() {
    this._destroyed = true
    clearTimeout(this._debounceTimer)
    if (this.view) this.view.destroy()
  },
}

export default CodeMirrorEditor
