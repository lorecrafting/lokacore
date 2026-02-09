import { describe, it, expect } from 'vitest'
import { parseMarkupSegments } from '../terminalMarkup.js'

describe('parseMarkupSegments', () => {
  it('returns plain text as a single text segment', () => {
    const result = parseMarkupSegments('hello world')
    expect(result).toEqual([{ type: 'text', value: 'hello world' }])
  })

  it('parses single cmd markup into a link segment', () => {
    const result = parseMarkupSegments('{{cmd:goto tavern}}tavern{{/cmd}}')
    expect(result).toEqual([{ type: 'link', cmd: 'goto tavern', text: 'tavern' }])
  })

  it('preserves text before and after markup', () => {
    const result = parseMarkupSegments('Go to {{cmd:goto tavern}}tavern{{/cmd}} now')
    expect(result).toEqual([
      { type: 'text', value: 'Go to ' },
      { type: 'link', cmd: 'goto tavern', text: 'tavern' },
      { type: 'text', value: ' now' },
    ])
  })

  it('handles multiple markup spans', () => {
    const result = parseMarkupSegments('{{cmd:info a}}a{{/cmd}} - {{cmd:look b}}b{{/cmd}}')
    expect(result).toEqual([
      { type: 'link', cmd: 'info a', text: 'a' },
      { type: 'text', value: ' - ' },
      { type: 'link', cmd: 'look b', text: 'b' },
    ])
  })

  it('returns empty array for empty string', () => {
    expect(parseMarkupSegments('')).toEqual([])
  })

  it('handles adjacent markup spans with no text between', () => {
    const result = parseMarkupSegments('{{cmd:a}}one{{/cmd}}{{cmd:b}}two{{/cmd}}')
    expect(result).toEqual([
      { type: 'link', cmd: 'a', text: 'one' },
      { type: 'link', cmd: 'b', text: 'two' },
    ])
  })

  it('preserves HTML-like text without interpreting it', () => {
    const result = parseMarkupSegments('{{cmd:x}}<b>bold</b>{{/cmd}}')
    expect(result).toEqual([{ type: 'link', cmd: 'x', text: '<b>bold</b>' }])
  })

  it('handles command with complex keys like quest info', () => {
    const result = parseMarkupSegments('{{cmd:quest info side_mountain_peak}}side_mountain_peak{{/cmd}}')
    expect(result).toEqual([
      { type: 'link', cmd: 'quest info side_mountain_peak', text: 'side_mountain_peak' },
    ])
  })
})
