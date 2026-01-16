/**
 * Anthropic Client for World Builder
 *
 * Client-side API calls to Anthropic with streaming support.
 * Uses BYOK (Bring Your Own Key) - key stored in localStorage.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

/**
 * Get the API key from localStorage
 * @returns {string|null} The decrypted API key or null
 */
export function getApiKey() {
  const encrypted = localStorage.getItem('anthropic_api_key_encrypted')
  if (!encrypted) return null

  try {
    return atob(encrypted).replace('loka_wb_', '')
  } catch {
    return null
  }
}

/**
 * Check if API key is configured
 * @returns {boolean}
 */
export function isConfigured() {
  return getApiKey() !== null
}

/**
 * Send a message to Claude with streaming
 *
 * @param {Object} options
 * @param {string} options.model - Model to use (default: claude-opus-4-5-20251101)
 * @param {Array} options.messages - Conversation messages
 * @param {string} options.system - System prompt
 * @param {Array} options.tools - Tool definitions (optional)
 * @param {number} options.maxTokens - Max tokens in response (default: 4096)
 * @param {function} options.onText - Callback for text chunks
 * @param {function} options.onToolUse - Callback for tool use blocks
 * @param {function} options.onComplete - Callback when done
 * @param {function} options.onError - Callback on error
 * @returns {Promise<Object>} Final response
 */
export async function streamMessage({
  model = 'claude-opus-4-5-20251101',
  messages,
  system,
  tools = [],
  maxTokens = 4096,
  onText = () => {},
  onToolUse = () => {},
  onComplete = () => {},
  onError = () => {}
}) {
  const apiKey = getApiKey()
  if (!apiKey) {
    const error = new Error('API key not configured')
    onError(error)
    throw error
  }

  const body = {
    model,
    max_tokens: maxTokens,
    messages,
    stream: true
  }

  if (system) {
    body.system = system
  }

  if (tools && tools.length > 0) {
    body.tools = tools
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorBody = await response.text()
      let errorMessage = `API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorBody)
        errorMessage = errorJson.error?.message || errorMessage
      } catch {}
      const error = new Error(errorMessage)
      onError(error)
      throw error
    }

    // Parse SSE stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''
    let toolUseBlocks = []
    let currentToolUse = null
    let inputUsage = 0
    let outputUsage = 0
    let stopReason = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const event = JSON.parse(data)

          switch (event.type) {
            case 'message_start':
              inputUsage = event.message?.usage?.input_tokens || 0
              break

            case 'content_block_start':
              if (event.content_block?.type === 'tool_use') {
                currentToolUse = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: ''
                }
              }
              break

            case 'content_block_delta':
              if (event.delta?.type === 'text_delta') {
                const text = event.delta.text || ''
                fullText += text
                onText(text, fullText)
              } else if (event.delta?.type === 'input_json_delta') {
                if (currentToolUse) {
                  currentToolUse.input += event.delta.partial_json || ''
                }
              }
              break

            case 'content_block_stop':
              if (currentToolUse) {
                // Parse the accumulated JSON input
                try {
                  currentToolUse.input = JSON.parse(currentToolUse.input)
                } catch {
                  currentToolUse.input = {}
                }
                toolUseBlocks.push(currentToolUse)
                onToolUse(currentToolUse)
                currentToolUse = null
              }
              break

            case 'message_delta':
              stopReason = event.delta?.stop_reason
              outputUsage = event.usage?.output_tokens || 0
              break

            case 'message_stop':
              // Message complete
              break

            case 'error':
              const error = new Error(event.error?.message || 'Unknown error')
              onError(error)
              throw error
          }
        } catch (parseError) {
          // Ignore parse errors for malformed events
          if (parseError.message !== 'Unknown error') {
            console.warn('Failed to parse SSE event:', parseError)
          }
        }
      }
    }

    const result = {
      text: fullText,
      toolUse: toolUseBlocks,
      stopReason,
      usage: {
        inputTokens: inputUsage,
        outputTokens: outputUsage,
        totalTokens: inputUsage + outputUsage
      }
    }

    onComplete(result)
    return result

  } catch (error) {
    onError(error)
    throw error
  }
}

/**
 * Send a message without streaming (simpler API)
 *
 * @param {Object} options - Same as streamMessage but without streaming callbacks
 * @returns {Promise<Object>} Response with text and tool use
 */
export async function sendMessage(options) {
  return streamMessage({
    ...options,
    onText: () => {},
    onToolUse: () => {},
    onComplete: () => {},
    onError: () => {}
  })
}

/**
 * Estimate token count for a message (rough approximation)
 * Uses ~4 characters per token as rough estimate
 *
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Format messages for the API
 *
 * @param {Array} messages - Array of {role, content} or {role, content: [{type, ...}]}
 * @returns {Array} Formatted messages
 */
export function formatMessages(messages) {
  return messages.map(msg => {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content }
    }
    return msg
  })
}

export default {
  getApiKey,
  isConfigured,
  streamMessage,
  sendMessage,
  estimateTokens,
  formatMessages
}
