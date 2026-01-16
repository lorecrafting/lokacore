import React, { useState, useRef, useEffect, useCallback } from 'react';
import { streamMessage, isConfigured } from './AnthropicClient.js';
import { allTools } from './ToolDefinitions.js';
import { buildWorldContext } from './ContextBuilder.js';

// ============================================================================
// Constants
// ============================================================================

const MODELS = [
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', costPer1kInput: 0.015, costPer1kOutput: 0.075 },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', costPer1kInput: 0.0008, costPer1kOutput: 0.004 },
];

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
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [usage, setUsage] = useState({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
  const [isConfiguredState, setIsConfiguredState] = useState(isConfigured());

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Check if API is configured
  useEffect(() => {
    const checkConfig = () => setIsConfiguredState(isConfigured());
    window.addEventListener('storage', checkConfig);
    return () => window.removeEventListener('storage', checkConfig);
  }, []);

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
      const model = MODELS.find(m => m.id === selectedModel) || MODELS[0];
      let assistantContent = '';
      let toolCalls = [];

      const result = await streamMessage({
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
  }, [inputValue, isLoading, messages, selectedModel, buildCurrentContext, onToolResult, pushEvent]);

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

  if (!isConfiguredState) {
    return (
      <div className="chat-panel">
        <div className="chat-unconfigured">
          <p>Configure your Anthropic API key in Settings to enable AI assistance.</p>
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

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-left">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="model-selector"
          >
            {MODELS.map(m => (
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
