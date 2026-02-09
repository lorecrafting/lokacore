/**
 * @file terminalMarkup.js - Parsing logic for {{cmd:...}} terminal markup
 *
 * Separated from mud_terminal.js for testability (no Phoenix/DOM dependencies).
 * The MudTerminal hook imports this and converts segments to DOM nodes.
 *
 * Markup format: {{cmd:COMMAND}}VISIBLE_TEXT{{/cmd}}
 * Parsed client-side into clickable <span class="term-link"> elements.
 */

/**
 * Parses {{cmd:COMMAND}}TEXT{{/cmd}} markup into an array of segments.
 * Each segment is either { type: 'text', value } or { type: 'link', cmd, text }.
 * Pure data — no DOM dependency.
 */
export function parseMarkupSegments(text) {
  const segments = []
  const re = /\{\{cmd:([^}]+)\}\}(.*?)\{\{\/cmd\}\}/g
  let last = 0
  let match

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', value: text.slice(last, match.index) })
    }
    segments.push({ type: 'link', cmd: match[1], text: match[2] })
    last = re.lastIndex
  }

  if (last < text.length) {
    segments.push({ type: 'text', value: text.slice(last) })
  }
  return segments
}
