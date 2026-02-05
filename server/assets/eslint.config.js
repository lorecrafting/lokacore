import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        getComputedStyle: 'readonly',
        ResizeObserver: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        EventSource: 'readonly',
        DOMParser: 'readonly',
        XMLSerializer: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        structuredClone: 'readonly',
        queueMicrotask: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        process: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      // Allow console methods for hooks (prefixed logging like '[HookName] message')
      // and for the event debug logger (console.group/groupEnd)
      'no-console': ['warn', { allow: ['log', 'error', 'warn', 'group', 'groupEnd'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error'
    }
  },
  {
    files: ['js/world_builder/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        test: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      'no-console': 'off'
    }
  }
]
