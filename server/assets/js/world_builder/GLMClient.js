/**
 * GLM Client for World Builder
 *
 * Client-side API calls to GLM (Zhipu AI) with streaming support.
 * GLM uses an OpenAI-compatible API.
 * Uses BYOK (Bring Your Own Key) - key stored in localStorage.
 */

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

/**
 * Get the API key from localStorage
 * @returns {string|null} The decrypted API key or null
 */
export function getApiKey() {
  const encrypted = localStorage.getItem('glm_api_key_encrypted')
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
 * Convert Anthropic-style tools to OpenAI function format
 */
function convertToolsToFunctions(tools) {
  if (!tools || tools.length === 0) return undefined

  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }))
}

/**
 * Send a message to GLM with streaming
 *
 * @param {Object} options
 * @param {string} options.model - Model to use (e.g., 'glm-4', 'glm-4-flash')
 * @param {Array} options.messages - Conversation messages
 * @param {string} options.system - System prompt
 * @param {Array} options.tools - Tool definitions (optional)
 * @param {number} options.maxTokens - Max tokens in response
 * @param {function} options.onText - Callback for text chunks
 * @param {function} options.onToolUse - Callback for tool use blocks
 * @param {function} options.onComplete - Callback when done
 * @param {function} options.onError - Callback on error
 * @returns {Promise<Object>} Final response
 */
export async function streamMessage({
  model = 'glm-4-flash',
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
    const error = new Error('GLM API key not configured')
    onError(error)
    throw error
  }

  // Build messages array with system prompt
  const apiMessages = []
  if (system) {
    apiMessages.push({ role: 'system', content: system })
  }
  apiMessages.push(...messages)

  const body = {
    model,
    max_tokens: maxTokens,
    messages: apiMessages,
    stream: true
  }

  const functions = convertToolsToFunctions(tools)
  if (functions) {
    body.tools = functions
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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
    let toolCalls = []
    let inputUsage = 0
    let outputUsage = 0

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
          const choice = event.choices?.[0]
          const delta = choice?.delta

          if (delta?.content) {
            fullText += delta.content
            onText(delta.content, fullText)
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = {
                    id: tc.id || `tool_${tc.index}`,
                    name: tc.function?.name || '',
                    input: ''
                  }
                }
                if (tc.function?.name) {
                  toolCalls[tc.index].name = tc.function.name
                }
                if (tc.function?.arguments) {
                  toolCalls[tc.index].input += tc.function.arguments
                }
              }
            }
          }

          // Capture usage if provided
          if (event.usage) {
            inputUsage = event.usage.prompt_tokens || 0
            outputUsage = event.usage.completion_tokens || 0
          }

        } catch (parseError) {
          // Ignore parse errors for malformed events
        }
      }
    }

    // Parse tool call inputs and notify
    for (const tc of toolCalls) {
      if (tc && tc.input) {
        try {
          tc.input = JSON.parse(tc.input)
        } catch {
          tc.input = {}
        }
        onToolUse(tc)
      }
    }

    const result = {
      text: fullText,
      toolUse: toolCalls.filter(Boolean),
      stopReason: 'end_turn',
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
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export default {
  getApiKey,
  isConfigured,
  streamMessage,
  estimateTokens
}
