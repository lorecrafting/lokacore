import { EditorView, basicSetup } from "codemirror"
import { StreamLanguage } from "@codemirror/language"
import { oneDark } from "@codemirror/theme-one-dark"

// CodeMirror 6 - Elixir script editor (bundled, no CDN)
const CodeMirrorEditor = {
  mounted() {
    // Define Elixir-like tokenizer via StreamLanguage
    const elixirLang = StreamLanguage.define({
      startState() { return { inString: false, stringChar: null } },
      token(stream, state) {
        if (stream.eatSpace()) return null

        // Comments
        if (stream.match('#')) { stream.skipToEnd(); return 'comment' }

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
        if (stream.match(/0x[0-9a-fA-F]+/) || stream.match(/0b[01]+/) || stream.match(/\d+(\.\d+)?/)) return 'number'

        // Keywords
        if (stream.match(/\b(def|defp|defmodule|defmacro|defstruct|defprotocol|defimpl|do|end|if|else|unless|case|cond|when|and|or|not|in|fn|with|for|raise|try|catch|rescue|after|receive|send|import|alias|require|use|true|false|nil)\b/)) return 'keyword'

        // Identifiers with ! or ?
        if (stream.match(/[a-z_][a-z0-9_]*[!?]?/)) return 'variableName'

        // Module names (capitalized)
        if (stream.match(/[A-Z][a-zA-Z0-9_]*/)) return 'typeName'

        // Operators
        if (stream.match(/->|<-|\|>|=>|::|&&|\|\||==|!=|<=|>=|=~|\+\+|--|\.\./)) return 'operator'

        stream.next()
        return null
      }
    })

    const initialValue = this.el.dataset.value || ''

    this.view = new EditorView({
      doc: initialValue,
      extensions: [
        basicSetup,
        elixirLang,
        oneDark,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.pushEvent('script_source_changed', {
              source: update.state.doc.toString()
            })
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
  },

  destroyed() {
    if (this.view) this.view.destroy()
  }
}

export default CodeMirrorEditor
