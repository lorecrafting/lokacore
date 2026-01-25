import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as AnthropicClient from './AnthropicClient.js';
import * as OpenAIClient from './OpenAIClient.js';
import * as DeepSeekClient from './DeepSeekClient.js';
import * as GeminiClient from './GeminiClient.js';
import * as GLMClient from './GLMClient.js';
import * as MinimaxClient from './MinimaxClient.js';
import { allTools } from './ToolDefinitions.js';
import { buildWorldContext } from './ContextBuilder.js';

// ============================================================================
// Constants - Providers and Models
// ============================================================================

const PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    client: AnthropicClient,
    keyPrefix: 'sk-ant-',
    models: [
      // Latest models
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', costPer1kInput: 0.015, costPer1kOutput: 0.075 },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', costPer1kInput: 0.003, costPer1kOutput: 0.015 },
      // Claude 3.5 family
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', costPer1kInput: 0.003, costPer1kOutput: 0.015 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', costPer1kInput: 0.0008, costPer1kOutput: 0.004 },
      // Claude 3 family
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', costPer1kInput: 0.015, costPer1kOutput: 0.075 },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', costPer1kInput: 0.003, costPer1kOutput: 0.015 },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', costPer1kInput: 0.00025, costPer1kOutput: 0.00125 },
    ]
  },
  openai: {
    name: 'OpenAI',
    client: OpenAIClient,
    keyPrefix: 'sk-',
    models: [
      // Reasoning models (o-series)
      { id: 'o1', name: 'o1 (Reasoning)', costPer1kInput: 0.015, costPer1kOutput: 0.06 },
      { id: 'o1-mini', name: 'o1 Mini', costPer1kInput: 0.003, costPer1kOutput: 0.012 },
      { id: 'o1-preview', name: 'o1 Preview', costPer1kInput: 0.015, costPer1kOutput: 0.06 },
      { id: 'o3-mini', name: 'o3 Mini', costPer1kInput: 0.00115, costPer1kOutput: 0.0044 },
      // GPT-4o family
      { id: 'gpt-4o', name: 'GPT-4o', costPer1kInput: 0.0025, costPer1kOutput: 0.01 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
      // GPT-4 family
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', costPer1kInput: 0.01, costPer1kOutput: 0.03 },
      { id: 'gpt-4', name: 'GPT-4', costPer1kInput: 0.03, costPer1kOutput: 0.06 },
      // GPT-3.5
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', costPer1kInput: 0.0005, costPer1kOutput: 0.0015 },
    ]
  },
  deepseek: {
    name: 'DeepSeek',
    client: DeepSeekClient,
    keyPrefix: 'sk-',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', costPer1kInput: 0.00014, costPer1kOutput: 0.00028 },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', costPer1kInput: 0.00055, costPer1kOutput: 0.00219 },
    ]
  },
  gemini: {
    name: 'Google Gemini',
    client: GeminiClient,
    keyPrefix: 'AIza',
    models: [
      // Versioned (Try these if others fail)
      { id: 'gemini-1.5-flash-001', name: 'Gemini 1.5 Flash-001 (Stable)', costPer1kInput: 0.000075, costPer1kOutput: 0.0003 },
      { id: 'gemini-1.5-pro-001', name: 'Gemini 1.5 Pro-001 (Stable)', costPer1kInput: 0.00125, costPer1kOutput: 0.005 },
      
      // Aliases
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Latest)', costPer1kInput: 0.000075, costPer1kOutput: 0.0003 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Latest)', costPer1kInput: 0.00125, costPer1kOutput: 0.005 },
      { id: 'gemini-pro', name: 'Gemini 1.0 Pro', costPer1kInput: 0.0005, costPer1kOutput: 0.0015 },
      
      // Experimental
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Exp)', costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
    ]
  },
  glm: {
    name: 'GLM (Zhipu AI)',
    client: GLMClient,
    keyPrefix: '',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus', costPer1kInput: 0.007, costPer1kOutput: 0.007 },
      { id: 'glm-4-long', name: 'GLM-4 Long (1M)', costPer1kInput: 0.0014, costPer1kOutput: 0.0014 },
      { id: 'glm-4-flash', name: 'GLM-4 Flash', costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
      { id: 'glm-4-flashx', name: 'GLM-4 FlashX', costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
      { id: 'glm-4-air', name: 'GLM-4 Air', costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
      { id: 'glm-4-airx', name: 'GLM-4 AirX', costPer1kInput: 0.0014, costPer1kOutput: 0.0014 },
    ]
  },
  minimax: {
    name: 'Minimax',
    client: MinimaxClient,
    keyPrefix: '',
    models: [
      { id: 'MiniMax-Text-01', name: 'MiniMax Text 01', costPer1kInput: 0.0011, costPer1kOutput: 0.0055 },
      { id: 'abab6.5s-chat', name: 'ABAB 6.5S', costPer1kInput: 0.0014, costPer1kOutput: 0.0014 },
      { id: 'abab6.5g-chat', name: 'ABAB 6.5G', costPer1kInput: 0.0007, costPer1kOutput: 0.0007 },
      { id: 'abab6.5t-chat', name: 'ABAB 6.5T', costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
    ]
  }
};

// Helper to get client for a provider
const getClient = (providerId) => PROVIDERS[providerId]?.client || AnthropicClient;

// Helper to check if any provider is configured
const isAnyProviderConfigured = () => {
  return Object.keys(PROVIDERS).some(id => !!localStorage.getItem(`${id}_api_key_encrypted`));
};

// Helper to get configured providers
const getConfiguredProviders = () => {
  return Object.keys(PROVIDERS)
    .filter(id => !!localStorage.getItem(`${id}_api_key_encrypted`));
};

const SYSTEM_PROMPT = `You are an AI assistant helping to build a game world using the Loka MUD engine World Builder.

You have access to tools to create, update, and delete game entities:
- Rooms: The locations players can explore
- NPCs: Non-player characters with dialogue and behaviors
- Items: Objects players can interact with
- Quests: Tasks and storylines for players
- Scripts: Elixir code for custom behaviors

When the user asks to create or modify content, use the appropriate tools. Always be concise but helpful.

Current context about the world being edited is provided in each message.`;

// ============================================================================
// Message Components
// ============================================================================

const UserMessage = ({ content }) => (
  <div className="chat-message user-message">
    <div className="message-header">
      <span className="message-role">You</span>
    </div>
    <div className="message-content">{content}</div>
  </div>
);

const AssistantMessage = ({ content, toolCalls, isStreaming }) => (
  <div className="chat-message assistant-message">
    <div className="message-header">
      <span className="message-role">Claude</span>
      {isStreaming && <span className="streaming-indicator">●</span>}
    </div>
    <div className="message-content">
      {content || (isStreaming && '...')}
    </div>
    {toolCalls && toolCalls.length > 0 && (
      <div className="tool-calls">
        {toolCalls.map((tool, idx) => (
          <ToolCallDisplay key={idx} tool={tool} />
        ))}
      </div>
    )}
  </div>
);

const ToolCallDisplay = ({ tool }) => (
  <div className={`tool-call ${tool.status || 'pending'}`}>
    <div className="tool-header">
      <span className="tool-icon">
        {tool.status === 'success' ? '✓' : tool.status === 'error' ? '✗' : '⋯'}
      </span>
      <span className="tool-name">{tool.name}</span>
    </div>
    {tool.input && (
      <div className="tool-input">
        <pre>{JSON.stringify(tool.input, null, 2)}</pre>
      </div>
    )}
    {tool.result && (
      <div className="tool-result">
        <pre>{typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}</pre>
      </div>
    )}
  </div>
);

// ============================================================================
// Context Summary Component
// ============================================================================

const ContextSummary = ({ context }) => {
  if (!context) return null;

  return (
    <div className="context-summary">
      <div className="context-header">Context</div>
      <div className="context-items">
        {context.zone && (
          <span className="context-item">
            <span className="context-label">Zone:</span> {context.zone}
          </span>
        )}
        {context.selection && (
          <span className="context-item">
            <span className="context-label">Selected:</span> {context.selection}
          </span>
        )}
        {context.roomCount !== undefined && (
          <span className="context-item">
            <span className="context-label">Rooms:</span> {context.roomCount}
          </span>
        )}
        {context.errors > 0 && (
          <span className="context-item error">
            <span className="context-label">Errors:</span> {context.errors}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Cost Tracker Component
// ============================================================================

const CostTracker = ({ usage }) => {
  const totalCost = usage.totalCost.toFixed(4);
  const totalTokens = usage.inputTokens + usage.outputTokens;

  return (
    <div className="cost-tracker">
      <span className="cost-label">Tokens:</span>
      <span className="cost-value">{totalTokens.toLocaleString()}</span>
      <span className="cost-label">Cost:</span>
      <span className="cost-value">${totalCost}</span>
    </div>
  );
};

// ============================================================================
// Main Chat Panel Component
// ============================================================================

export default function ChatPanel({
  rooms = [],
  selectedRoom = null,
  validation = {},
  onToolResult = () => {},
  pushEvent = () => {}
}) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingToolCalls, setPendingToolCalls] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(() => {
    // Default to first configured provider, or anthropic
    const configured = getConfiguredProviders();
    return configured[0] || 'anthropic';
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    const configured = getConfiguredProviders();
    const provider = configured[0] || 'anthropic';
    return PROVIDERS[provider].models[0].id;
  });
  const [usage, setUsage] = useState({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
  const [isConfiguredState, setIsConfiguredState] = useState(isAnyProviderConfigured());

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Check if any API is configured
  useEffect(() => {
    const checkConfig = () => {
      setIsConfiguredState(isAnyProviderConfigured());
      // If current provider is no longer configured, switch to a configured one
      if (!PROVIDERS[selectedProvider]?.client.isConfigured()) {
        const configured = getConfiguredProviders();
        if (configured.length > 0 && configured[0] !== selectedProvider) {
          setSelectedProvider(configured[0]);
          setSelectedModel(PROVIDERS[configured[0]].models[0].id);
        }
      }
    };
    window.addEventListener('storage', checkConfig);
    // Also check periodically in case localStorage was changed by settings modal
    const interval = setInterval(checkConfig, 1000);
    return () => {
      window.removeEventListener('storage', checkConfig);
      clearInterval(interval);
    };
  }, [selectedProvider]);

  // Build context for the current state
  const buildCurrentContext = useCallback(() => {
    return {
      summary: buildWorldContext({ rooms, selectedRoom })
    };
  }, [rooms, selectedRoom]);

  // Get context summary for display
  const contextSummary = {
    zone: selectedRoom?.zone || 'No zone',
    selection: selectedRoom?.key || 'None',
    roomCount: rooms.length,
    errors: Object.values(validation).filter(v => !v?.isValid).length
  };

  // Handle sending a message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setStreamingContent('');
    setPendingToolCalls([]);

    // Add user message
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    // Build context and system prompt
    const context = buildCurrentContext();
    const contextText = context.summary;
    const systemWithContext = `${SYSTEM_PROMPT}\n\n## Current World State\n${contextText}`;

    // Format messages for API
    const apiMessages = newMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const provider = PROVIDERS[selectedProvider];
      const model = provider.models.find(m => m.id === selectedModel) || provider.models[0];
      const client = provider.client;
      let assistantContent = '';
      let toolCalls = [];

      const result = await client.streamMessage({
        model: selectedModel,
        messages: apiMessages,
        system: systemWithContext,
        tools: allTools,
        maxTokens: 4096,
        onText: (chunk, full) => {
          assistantContent = full;
          setStreamingContent(full);
        },
        onToolUse: async (tool) => {
          const pendingTool = { ...tool, status: 'pending' };
          toolCalls.push(pendingTool);
          setPendingToolCalls([...toolCalls]);

          // Execute tool via LiveView pushEvent
          try {
            // Send tool call to LiveView and wait for result
            // For now, just record the tool use - actual execution in q47.12
            pushEvent('execute_tool', { name: tool.name, input: tool.input });
            pendingTool.status = 'success';
            pendingTool.result = 'Tool executed (see console)';
            onToolResult(tool.name, tool.input, pendingTool.result);
          } catch (error) {
            pendingTool.status = 'error';
            pendingTool.result = error.message;
          }
          setPendingToolCalls([...toolCalls]);
        },
        onComplete: (response) => {
          // Update usage
          const inputCost = (response.usage.inputTokens / 1000) * model.costPer1kInput;
          const outputCost = (response.usage.outputTokens / 1000) * model.costPer1kOutput;

          setUsage(prev => ({
            inputTokens: prev.inputTokens + response.usage.inputTokens,
            outputTokens: prev.outputTokens + response.usage.outputTokens,
            totalCost: prev.totalCost + inputCost + outputCost
          }));
        }
      });

      // Add assistant message
      setMessages([...newMessages, {
        role: 'assistant',
        content: result.text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      }]);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: `Error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setPendingToolCalls([]);
    }
  }, [inputValue, isLoading, messages, selectedProvider, selectedModel, buildCurrentContext, onToolResult, pushEvent]);

  // Handle keyboard events
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Clear chat history
  const handleClear = () => {
    setMessages([]);
    setUsage({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
  };

  // Handle provider change
  const handleProviderChange = (newProvider) => {
    setSelectedProvider(newProvider);
    // Reset to first model of new provider
    setSelectedModel(PROVIDERS[newProvider].models[0].id);
  };

  if (!isConfiguredState) {
    const providerNames = Object.values(PROVIDERS).map(p => p.name).join(', ');
    return (
      <div className="chat-panel">
        <div className="chat-unconfigured">
          <p className="chat-unconfigured-title">AI Assistant</p>
          <p className="chat-unconfigured-desc">Configure an API key to enable AI-powered world building.</p>
          <p className="chat-unconfigured-providers">
            {providerNames}
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => pushEvent('show_settings', {})}
          >
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  const currentProvider = PROVIDERS[selectedProvider];
  const configuredProviders = getConfiguredProviders();

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-left">
          <select
            value={selectedProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="provider-selector"
            title="Select AI Provider"
          >
            {configuredProviders.map(id => (
              <option key={id} value={id}>{PROVIDERS[id].name}</option>
            ))}
          </select>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="model-selector"
            title="Select Model"
          >
            {currentProvider.models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="chat-header-right">
          <CostTracker usage={usage} />
          <button
            className="btn-icon"
            onClick={handleClear}
            title="Clear chat"
          >
            ✕
          </button>
        </div>
      </div>

      <ContextSummary context={contextSummary} />

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Ask Claude to help you build your world!</p>
            <p className="chat-hints">
              Try: "Create a tavern room with a cozy description"<br />
              Or: "Add an NPC bartender to the current room"
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          msg.role === 'user' ? (
            <UserMessage key={idx} content={msg.content} />
          ) : (
            <AssistantMessage
              key={idx}
              content={msg.content}
              toolCalls={msg.toolCalls}
            />
          )
        ))}
        {isLoading && (
          <AssistantMessage
            content={streamingContent}
            toolCalls={pendingToolCalls}
            isStreaming={true}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude to help..."
          className="chat-input"
          rows={2}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
          className="chat-send-btn"
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
