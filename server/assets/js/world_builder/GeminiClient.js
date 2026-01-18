/**
 * Google Gemini Client for World Builder
 *
 * Client-side API calls to Google Gemini with streaming support.
 * Uses BYOK (Bring Your Own Key) - key stored in localStorage.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Get the API key from localStorage
 * @returns {string|null} The decrypted API key or null
 */
export function getApiKey() {
  const encrypted = localStorage.getItem('gemini_api_key_encrypted')
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
 * Convert Anthropic-style tools to Gemini function declarations
 */
function convertToolsToGemini(tools) {
  if (!tools || tools.length === 0) return undefined

  return [{
    functionDeclarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }))
  }]
}

/**
 * Convert messages to Gemini format
 */
function convertMessagesToGemini(messages, system) {
  const contents = []

  for (const msg of messages) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })
  }

  return contents
}

/**
 * Send a message to Gemini with streaming
 *
 * @param {Object} options
 * @param {string} options.model - Model to use
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
  model = 'gemini-2.0-flash',
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
    const error = new Error('Gemini API key not configured')
    onError(error)
    throw error
  }

  const url = `${API_BASE}/${model}:streamGenerateContent?key=${apiKey}&alt=sse`

  const contents = convertMessagesToGemini(messages, system)
  const geminiTools = convertToolsToGemini(tools)

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens
    }
  }

  // Add system instruction if provided
  if (system) {
    body.systemInstruction = {
      parts: [{ text: system }]
    }
  }

  if (geminiTools) {
    body.tools = geminiTools
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
        const data = line.slice(6).trim()
        if (!data || data === '[DONE]') continue

        try {
          const event = JSON.parse(data)

          // Extract text from candidates
          const candidates = event.candidates || []
          for (const candidate of candidates) {
            const content = candidate.content
            if (content?.parts) {
              for (const part of content.parts) {
                if (part.text) {
                  fullText += part.text
                  onText(part.text, fullText)
                }
                // Handle function calls
                if (part.functionCall) {
                  const tc = {
                    id: `gemini_${toolCalls.length}`,
                    name: part.functionCall.name,
                    input: part.functionCall.args || {}
                  }
                  toolCalls.push(tc)
                  onToolUse(tc)
                }
              }
            }
          }

          // Capture usage metadata
          if (event.usageMetadata) {
            inputUsage = event.usageMetadata.promptTokenCount || 0
            outputUsage = event.usageMetadata.candidatesTokenCount || 0
          }

        } catch (parseError) {
          // Ignore parse errors for malformed events
        }
      }
    }

    const result = {
      text: fullText,
      toolUse: toolCalls,
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
