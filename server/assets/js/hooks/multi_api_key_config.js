// Multi-Provider API Key Configuration - BYOK for multiple AI providers
const MultiAPIKeyConfig = {
  mounted() {
    this.abortController = new AbortController()
    const providers = ['anthropic', 'openai', 'deepseek', 'gemini', 'glm', 'minimax']

    // Check stored keys for all providers on mount
    providers.forEach(provider => {
      try {
        this.validateStoredKey(provider)
      } catch (e) {
        console.error('[MultiAPIKeyConfig] Error validating stored key for', provider, e)
        this.pushEvent('api_key_status', { provider: provider, status: 'error' })
      }
    })

    // Use event delegation to handle clicks on buttons,
    // which survives DOM updates from LiveView
    this.handleClick = (e) => {
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
    }
    this.el.addEventListener('click', this.handleClick)

    // Handle enter key in inputs
    this.handleKeypress = (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('api-key-input')) {
        const provider = e.target.dataset.provider
        const key = e.target.value.trim()
        if (key) {
          this.saveAndValidateKey(provider, key)
        }
      }
    }
    this.el.addEventListener('keypress', this.handleKeypress)
  },

  async saveAndValidateKey(provider, key) {
    // Update UI to show validating
    this.pushEvent('api_key_validated', { provider, status: 'validating' })

    try {
      const isValid = await this.validateKey(provider, key)

      // Store encoded in localStorage regardless of validation status
      // so the user can at least attempt to use it.
      const encoded = btoa('loka_wb_' + key)
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
        console.warn(`[MultiAPIKeyConfig] API key for ${provider} was saved but validation failed. Check your key.`)
      }
    } catch (error) {
      console.error(`[MultiAPIKeyConfig] API key validation failed for ${provider}:`, error)

      // Even on network error, try to save the key
      const encoded = btoa('loka_wb_' + key)
      try {
        localStorage.setItem(`${provider}_api_key_encoded`, encoded)
      } catch (e) {
        console.warn('[MultiAPIKeyConfig] localStorage unavailable:', e.message)
      }

      this.pushEvent('api_key_validated', { provider, status: 'invalid' })
    }
  },

  async validateKey(provider, key) {
    // Provider-specific validation
    switch (provider) {
      case 'anthropic':
        return this.validateAnthropicKey(key)
      case 'openai':
        return this.validateOpenAIKey(key)
      case 'deepseek':
        return this.validateDeepSeekKey(key)
      case 'gemini':
        return this.validateGeminiKey(key)
      case 'glm':
        return this.validateGLMKey(key)
      case 'minimax':
        return this.validateMinimaxKey(key)
      default:
        return false
    }
  },

  async validateAnthropicKey(key) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: this.abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    } catch (error) {
      console.error('[MultiAPIKeyConfig] Anthropic validation error:', error)
      return false
    }
  },

  async validateOpenAIKey(key) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: this.abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    } catch (error) {
      console.error('[MultiAPIKeyConfig] OpenAI validation error:', error)
      return false
    }
  },

  async validateDeepSeekKey(key) {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        signal: this.abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    } catch (error) {
      console.error('[MultiAPIKeyConfig] DeepSeek validation error:', error)
      return false
    }
  },

  async validateGeminiKey(key) {
    // Use gemini-1.5-pro for validation as requested/more stable
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: this.abortController.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
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

  async validateGLMKey(key) {
    // GLM (Zhipu AI) uses OpenAI-compatible API
    try {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        signal: this.abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    } catch (error) {
      console.error('[MultiAPIKeyConfig] GLM validation error:', error)
      return false
    }
  },

  async validateMinimaxKey(key) {
    // Minimax uses OpenAI-compatible API
    try {
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        signal: this.abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'MiniMax-Text-01',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    } catch (error) {
      console.error('[MultiAPIKeyConfig] Minimax validation error:', error)
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
    this.abortController.abort()
    this.el.removeEventListener('click', this.handleClick)
    this.el.removeEventListener('keypress', this.handleKeypress)
  }
}

export default MultiAPIKeyConfig
