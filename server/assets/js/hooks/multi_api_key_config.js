// Multi-Provider API Key Configuration - BYOK for multiple AI providers
const MultiAPIKeyConfig = {
  mounted() {
    console.log('MultiAPIKeyConfig mounted')
    const providers = ['anthropic', 'openai', 'deepseek', 'gemini', 'glm', 'minimax']

    // Check stored keys for all providers on mount
    providers.forEach(provider => {
      try {
        this.validateStoredKey(provider)
      } catch (e) {
        console.error('Error validating stored key for', provider, e)
      }
    })

    // Use event delegation to handle clicks on buttons,
    // which survives DOM updates from LiveView
    this.el.addEventListener('click', (e) => {
      const saveBtn = e.target.closest('.api-key-save')
      const clearBtn = e.target.closest('.api-key-clear')

      if (saveBtn) {
        const provider = saveBtn.dataset.provider
        console.log('Save clicked for', provider)
        const input = this.el.querySelector(`#api-key-input-${provider}`)
        const key = input?.value?.trim()

        if (key) {
          console.log('Key present, saving...')
          this.saveAndValidateKey(provider, key)
        } else {
          console.log('No key entered')
        }
      } else if (clearBtn) {
        const provider = clearBtn.dataset.provider
        console.log('Clear clicked for', provider)
        this.clearKey(provider)
      }
    })

    // Handle enter key in inputs
    this.el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('api-key-input')) {
        const provider = e.target.dataset.provider
        const key = e.target.value.trim()
        if (key) {
          this.saveAndValidateKey(provider, key)
        }
      }
    })
  },

  async saveAndValidateKey(provider, key) {
    // Update UI to show validating
    this.pushEvent('api_key_validated', { provider, status: 'validating' })

    try {
      const isValid = await this.validateKey(provider, key)

      // Store encrypted in localStorage regardless of validation status
      // so the user can at least attempt to use it.
      // Use unicode-safe encoding
      const encrypted = btoa(unescape(encodeURIComponent('loka_wb_' + key)))
      localStorage.setItem(`${provider}_api_key_encrypted`, encrypted)

      if (isValid) {
        this.pushEvent('api_key_validated', { provider, status: 'valid' })

        // Clear input only on success
        const input = this.el.querySelector(`#api-key-input-${provider}`)
        if (input) input.value = ''
      } else {
        // Still mark as configured but invalid status
        this.pushEvent('api_key_validated', { provider, status: 'invalid' })
        console.warn(`API key for ${provider} was saved but validation failed. Check your key.`)
      }
    } catch (error) {
      console.error(`API key validation failed for ${provider}:`, error)

      // Even on network error, try to save the key
      // Use unicode-safe encoding
      const encrypted = btoa(unescape(encodeURIComponent('loka_wb_' + key)))
      localStorage.setItem(`${provider}_api_key_encrypted`, encrypted)

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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
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
  },

  async validateOpenAIKey(key) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
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
  },

  async validateDeepSeekKey(key) {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
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
  },

  async validateGeminiKey(key) {
    // Use gemini-1.5-pro for validation as requested/more stable
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`
    try {
      const response = await fetch(url, {
        method: 'POST',
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
        console.error('Gemini validation failed:', response.status, errorText)
      }

      return response.ok
    } catch (error) {
      console.error('Gemini validation network error:', error)
      return false
    }
  },

  async validateGLMKey(key) {
    // GLM (Zhipu AI) uses OpenAI-compatible API
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
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
  },

  async validateMinimaxKey(key) {
    // Minimax uses OpenAI-compatible API
    const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
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
  },

  async validateStoredKey(provider) {
    const encrypted = localStorage.getItem(`${provider}_api_key_encrypted`)
    if (!encrypted) {
      this.pushEvent('api_key_validated', { provider, status: 'unconfigured' })
      return
    }

    try {
      const key = atob(encrypted).replace('loka_wb_', '')
      this.pushEvent('api_key_validated', { provider, status: 'validating' })

      const isValid = await this.validateKey(provider, key)

      if (isValid) {
        this.pushEvent('api_key_validated', { provider, status: 'valid' })
      } else {
        // Key is invalid - remove it
        localStorage.removeItem(`${provider}_api_key_encrypted`)
        this.pushEvent('api_key_validated', { provider, status: 'invalid' })
      }
    } catch (error) {
      console.error(`Stored key validation failed for ${provider}:`, error)
      this.pushEvent('api_key_validated', { provider, status: 'unconfigured' })
    }
  },

  clearKey(provider) {
    localStorage.removeItem(`${provider}_api_key_encrypted`)
    this.pushEvent('api_key_validated', { provider, status: 'unconfigured' })
    // Clear the input field
    const input = this.el.querySelector(`#api-key-input-${provider}`)
    if (input) input.value = ''
  },

  destroyed() {
    // Cleanup if needed
  }
}

export default MultiAPIKeyConfig
