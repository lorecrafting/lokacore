/**
 * @file multi_api_key_config.js - BYOK (Bring Your Own Key) management for AI providers
 *
 * LLM CONTEXT:
 * - Keys are stored in localStorage with base64 encoding (NOT encryption, just obfuscation)
 * - Storage key format: `{provider}_api_key_encoded` (e.g., 'anthropic_api_key_encoded')
 * - Keys are validated by making a real API call with minimal tokens (max_tokens: 10)
 * - PROVIDER_CONFIG defines auth patterns for each provider:
 *   - openai-compatible: Bearer auth, chat/completions format (OpenAI, DeepSeek, GLM, MiniMax)
 *   - anthropic: x-api-key header, anthropic-version header
 *   - gemini: query-string API key, different request body format
 * - Uses event delegation for button clicks (survives LiveView DOM updates)
 * - AbortController cancels in-flight validations on destroy (prevents memory leaks)
 * - VALIDATION_TIMEOUT_MS (10s) prevents hung requests
 *
 * DO NOT:
 * - Store keys unencoded (always use btoa('loka_wb_' + key) pattern)
 * - Make validation requests without timeout/abort handling
 * - Assume localStorage is available (wrap in try/catch)
 * - Add new providers without updating PROVIDER_CONFIG
 *
 * EVENTS:
 * pushEvent (JS -> Server):
 *   - api_key_status { provider, status } -- error during initial validation
 *   - api_key_validated { provider, status } -- validation result
 *     status: 'validating' | 'valid' | 'invalid' | 'unconfigured'
 *
 * handleEvent (Server -> JS):
 *   - (none)
 *
 * @related
 *   - lib/loka_web/live/admin_live/builder_live.ex (settings UI)
 * @used_by BuilderLive settings
 */

import { HookHelper } from './HookHelper.js'

// Provider configuration for API key validation
// Each entry defines the endpoint, model, and validation type.
// 'openai-compatible' providers share the same Bearer-auth chat/completions format.
const PROVIDER_CONFIG = {
  anthropic: {
    type: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
  },
  openai: {
    type: 'openai-compatible',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
  deepseek: {
    type: 'openai-compatible',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
  },
  gemini: {
    type: 'gemini',
    endpoint:
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
    model: 'gemini-1.5-pro',
  },
  glm: {
    type: 'openai-compatible',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
  },
  minimax: {
    type: 'openai-compatible',
    endpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    model: 'MiniMax-Text-01',
  },
}

const VALIDATION_TIMEOUT_MS = 10000

// Multi-Provider API Key Configuration - BYOK for multiple AI providers
const MultiAPIKeyConfig = {
  mounted() {
    try {
      this.helper = new HookHelper(this)
      this.abortController = new AbortController()
      const providers = Object.keys(PROVIDER_CONFIG)

      if (!this.el) {
        console.warn('[MultiAPIKeyConfig] Element not found')
        return
      }

      // Check stored keys for all providers on mount
      providers.forEach((provider) => {
        try {
          this.validateStoredKey(provider)
        } catch (e) {
          console.error('[MultiAPIKeyConfig] Error validating stored key for', provider, e)
          this.pushEvent('api_key_status', { provider: provider, status: 'error' })
        }
      })

      // Use event delegation to handle clicks on buttons,
      // which survives DOM updates from LiveView
      this.helper.on(this.el, 'click', (e) => {
        const saveBtn = e.target.closest('.api-key-save')
        const clearBtn = e.target.closest('.api-key-clear')

        if (saveBtn) {
          const provider = saveBtn.dataset.provider
          const input = this.el.querySelector(`#api-key-input-${provider}`)
          const key = input?.value?.trim()

          if (key) {
            this.saveAndValidateKey(provider, key)
          }
        } else if (clearBtn) {
          const provider = clearBtn.dataset.provider
          this.clearKey(provider)
        }
      })

      // Handle enter key in inputs
      this.helper.on(this.el, 'keypress', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('api-key-input')) {
          const provider = e.target.dataset.provider
          const key = e.target.value.trim()
          if (key) {
            this.saveAndValidateKey(provider, key)
          }
        }
      })
    } catch (err) {
      console.error('[MultiAPIKeyConfig] Failed to initialize:', err)
    }
  },

  async saveAndValidateKey(provider, key) {
    // Update UI to show validating
    this.pushEvent('api_key_validated', { provider, status: 'validating' })

    try {
      const isValid = await this.validateKey(provider, key)

      // Store encoded in localStorage regardless of validation status
      // so the user can at least attempt to use it.
      const encoded = btoa(`loka_wb_${key}`)
      try {
        localStorage.setItem(`${provider}_api_key_encoded`, encoded)
      } catch (e) {
        console.warn('[MultiAPIKeyConfig] localStorage unavailable:', e.message)
      }

      if (isValid) {
        this.pushEvent('api_key_validated', { provider, status: 'valid' })

        // Clear input only on success
        const input = this.el.querySelector(`#api-key-input-${provider}`)
        if (input) input.value = ''
      } else {
        // Still mark as configured but invalid status
        this.pushEvent('api_key_validated', { provider, status: 'invalid' })
        console.warn(
          `[MultiAPIKeyConfig] API key for ${provider} was saved but validation failed. Check your key.`
        )
      }
    } catch (error) {
      console.error(`[MultiAPIKeyConfig] API key validation failed for ${provider}:`, error)

      // Even on network error, try to save the key
      const encoded = btoa(`loka_wb_${key}`)
      try {
        localStorage.setItem(`${provider}_api_key_encoded`, encoded)
      } catch (e) {
        console.warn('[MultiAPIKeyConfig] localStorage unavailable:', e.message)
      }

      this.pushEvent('api_key_validated', { provider, status: 'invalid' })
    }
  },

  async validateKey(provider, key) {
    const config = PROVIDER_CONFIG[provider]
    if (!config) return false

    // Per-call timeout: abort after VALIDATION_TIMEOUT_MS
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS)

    // Also abort if the hook-level controller fires (e.g. on destroy)
    const onHookAbort = () => controller.abort()
    this.abortController.signal.addEventListener('abort', onHookAbort)

    try {
      switch (config.type) {
        case 'openai-compatible':
          return await this._validateOpenAICompatible(
            key,
            config.endpoint,
            config.model,
            controller.signal
          )
        case 'anthropic':
          return await this._validateAnthropic(
            key,
            config.endpoint,
            config.model,
            controller.signal
          )
        case 'gemini':
          return await this._validateGemini(key, config.endpoint, controller.signal)
        default:
          return false
      }
    } finally {
      clearTimeout(timeout)
      this.abortController.signal.removeEventListener('abort', onHookAbort)
    }
  },

  // Shared validation for OpenAI-compatible APIs (Bearer auth + chat/completions format)
  async _validateOpenAICompatible(key, endpoint, model, signal) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      })
      return response.ok
    } catch (error) {
      console.error('[MultiAPIKeyConfig] OpenAI-compatible validation error:', error)
      return false
    }
  },

  // Anthropic uses x-api-key header and custom anthropic-version header
  async _validateAnthropic(key, endpoint, model, signal) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      })
      return response.ok
    } catch (error) {
      console.error('[MultiAPIKeyConfig] Anthropic validation error:', error)
      return false
    }
  },

  // Gemini uses query-string API key and a different request body format
  async _validateGemini(key, endpoint, signal) {
    const url = `${endpoint}?key=${key}`
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[MultiAPIKeyConfig] Gemini validation failed:', response.status, errorText)
      }

      return response.ok
    } catch (error) {
      console.error('[MultiAPIKeyConfig] Gemini validation error:', error)
      return false
    }
  },

  async validateStoredKey(provider) {
    const encoded = localStorage.getItem(`${provider}_api_key_encoded`)
    if (!encoded) {
      this.pushEvent('api_key_validated', { provider, status: 'unconfigured' })
      return
    }

    try {
      const key = atob(encoded).replace('loka_wb_', '')
      this.pushEvent('api_key_validated', { provider, status: 'validating' })

      const isValid = await this.validateKey(provider, key)

      if (isValid) {
        this.pushEvent('api_key_validated', { provider, status: 'valid' })
      } else {
        // Key is invalid - remove it
        localStorage.removeItem(`${provider}_api_key_encoded`)
        this.pushEvent('api_key_validated', { provider, status: 'invalid' })
      }
    } catch (error) {
      console.error(`[MultiAPIKeyConfig] Stored key validation failed for ${provider}:`, error)
      this.pushEvent('api_key_validated', { provider, status: 'unconfigured' })
    }
  },

  clearKey(provider) {
    try {
      localStorage.removeItem(`${provider}_api_key_encoded`)
    } catch (e) {
      console.warn('[MultiAPIKeyConfig] localStorage unavailable:', e.message)
    }
    this.pushEvent('api_key_validated', { provider, status: 'unconfigured' })
    // Clear the input field
    const input = this.el.querySelector(`#api-key-input-${provider}`)
    if (input) input.value = ''
  },

  destroyed() {
    if (this.abortController) this.abortController.abort()
    if (this.helper) this.helper.destroy()
  },
}

export default MultiAPIKeyConfig
