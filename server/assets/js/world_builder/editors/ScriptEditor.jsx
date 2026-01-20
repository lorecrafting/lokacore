import React, { useState, useCallback, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';

// ============================================================================
// Constants
// ============================================================================

const HOOKS = [
  { value: 'on_enter', label: 'On Enter', description: 'When entity enters room' },
  { value: 'on_exit', label: 'On Exit', description: 'When entity exits room' },
  { value: 'on_look', label: 'On Look', description: 'When entity looks at something' },
  { value: 'on_talk', label: 'On Talk', description: 'When player talks to NPC' },
  { value: 'on_damage', label: 'On Damage', description: 'When entity takes damage' },
  { value: 'on_death', label: 'On Death', description: 'When entity dies' },
  { value: 'on_combat_start', label: 'On Combat Start', description: 'When combat begins' },
  { value: 'on_combat_end', label: 'On Combat End', description: 'When combat ends' },
  { value: 'on_item_use', label: 'On Item Use', description: 'When item is used' },
  { value: 'on_item_get', label: 'On Item Get', description: 'When item is picked up' },
  { value: 'on_meditate', label: 'On Meditate', description: 'When player meditates' },
  { value: 'on_tick', label: 'On Tick', description: 'Periodic tick (use sparingly)' },
  { value: 'at_enter_room', label: 'At Enter Room', description: 'Room entry hook' },
  { value: 'at_command_pre', label: 'At Command Pre', description: 'Before command executes' },
  { value: 'at_command_post', label: 'At Command Post', description: 'After command executes' },
];

// API Functions for reference
const API_FUNCTIONS = [
  { name: 'message', sig: 'message(text)', desc: 'Send message to player' },
  { name: 'say', sig: 'say(text)', desc: 'Entity speaks aloud' },
  { name: 'emote', sig: 'emote(text)', desc: 'Entity performs emote' },
  { name: 'announce_room', sig: 'announce_room(text)', desc: 'Message to all in room' },
  { name: 'has_item?', sig: 'has_item?(item_key)', desc: 'Check if player has item' },
  { name: 'has_flag?', sig: 'has_flag?(flag)', desc: 'Check if player has flag' },
  { name: 'get_flag', sig: 'get_flag(flag)', desc: 'Get flag value' },
  { name: 'set_flag', sig: 'set_flag(flag, value)', desc: 'Set flag value' },
  { name: 'get_stat', sig: 'get_stat(stat)', desc: 'Get entity stat' },
  { name: 'give_item', sig: 'give_item(item_key)', desc: 'Give item to player' },
  { name: 'remove_item', sig: 'remove_item(item_key)', desc: 'Remove item from player' },
  { name: 'spawn_npc', sig: 'spawn_npc(key, room)', desc: 'Spawn NPC in room' },
  { name: 'despawn', sig: 'despawn(entity_id)', desc: 'Remove entity' },
  { name: 'teleport', sig: 'teleport(entity_id, room)', desc: 'Move entity to room' },
  { name: 'damage', sig: 'damage(target, amount)', desc: 'Deal damage' },
  { name: 'heal', sig: 'heal(target, amount)', desc: 'Heal entity' },
  { name: 'apply_effect', sig: 'apply_effect(effect, duration)', desc: 'Apply status effect' },
  { name: 'quest_active?', sig: 'quest_active?(quest_key)', desc: 'Check if quest active' },
  { name: 'start_quest', sig: 'start_quest(quest_key)', desc: 'Start quest for player' },
  { name: 'complete_objective', sig: 'complete_objective(quest, obj)', desc: 'Mark objective done' },
  { name: 'continue', sig: 'continue()', desc: 'Allow default behavior' },
  { name: 'deny', sig: 'deny()', desc: 'Prevent default behavior' },
  { name: 'handled', sig: 'handled()', desc: 'Mark event handled' },
  { name: 'chance?', sig: 'chance?(percentage)', desc: 'Random check (0-100)' },
  { name: 'roll', sig: 'roll(sides)', desc: 'Roll dice' },
  { name: 'log', sig: 'log(message)', desc: 'Debug log' },
  { name: 'after', sig: 'after(seconds, script_key)', desc: 'Schedule script' },
  { name: 'entities_in_room', sig: 'entities_in_room()', desc: 'Get all entities' },
  { name: 'find_entity', sig: 'find_entity(key)', desc: 'Find entity by key' },
];

// Default script template
const DEFAULT_SOURCE = `# Script logic goes here
# Available: entity, player, context

if player do
  message("Hello!")
end

continue()
`;

// ============================================================================
// Validation Panel
// ============================================================================

const ValidationPanel = ({ errors, warnings }) => {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="validation-panel valid">
        <span className="validation-icon">✓</span>
        <span>Valid script</span>
      </div>
    );
  }

  return (
    <div className="validation-panel">
      {errors.map((err, i) => (
        <div key={`e-${i}`} className="validation-error">
          <span className="validation-icon">✗</span>
          {err}
        </div>
      ))}
      {warnings.map((warn, i) => (
        <div key={`w-${i}`} className="validation-warning">
          <span className="validation-icon">⚠</span>
          {warn}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// API Reference Panel
// ============================================================================

const APIReferencePanel = ({ searchQuery, onSearchChange }) => {
  const filtered = useMemo(() => {
    if (!searchQuery) return API_FUNCTIONS;
    const q = searchQuery.toLowerCase();
    return API_FUNCTIONS.filter(
      f => f.name.includes(q) || f.desc.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="api-reference-panel">
      <div className="api-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search API..."
          className="input-sm"
        />
      </div>
      <div className="api-list">
        {filtered.map((fn) => (
          <div key={fn.name} className="api-item">
            <code className="api-sig">{fn.sig}</code>
            <span className="api-desc">{fn.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Test Runner Panel
// ============================================================================

const TestRunnerPanel = ({ onRunTest, testResult, isRunning }) => {
  return (
    <div className="test-runner-panel">
      <div className="test-header">
        <h4>Test Runner</h4>
        <button
          onClick={onRunTest}
          disabled={isRunning}
          className="btn-sm btn-primary"
        >
          {isRunning ? 'Running...' : '▶ Run Test'}
        </button>
      </div>
      {testResult && (
        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
          <pre>{JSON.stringify(testResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Script Editor Component
// ============================================================================

export default function ScriptEditor({ onSave, onCancel, initialData, entities = [] }) {
  // Form state
  const [scriptKey, setScriptKey] = useState(initialData?.key || '');
  const [scriptName, setScriptName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [hook, setHook] = useState(initialData?.hook || 'on_talk');
  const [source, setSource] = useState(initialData?.source || DEFAULT_SOURCE);
  const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');
  const [entityKey, setEntityKey] = useState(initialData?.entity_key || '');

  // Validation state
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);

  // Test state
  const [testResult, setTestResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // API reference
  const [apiSearch, setApiSearch] = useState('');

  const editorRef = useRef(null);

  // Monaco editor configuration
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    tabSize: 2,
    automaticLayout: true,
  };

  // Handle editor mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add Elixir-like keywords (basic highlighting)
    monaco.languages.setMonarchTokensProvider('elixir', {
      keywords: [
        'def', 'defp', 'defmodule', 'do', 'end', 'if', 'else', 'unless',
        'case', 'cond', 'when', 'and', 'or', 'not', 'in', 'fn', 'true', 'false', 'nil'
      ],
      tokenizer: {
        root: [
          [/#.*$/, 'comment'],
          [/"[^"]*"/, 'string'],
          [/'[^']*'/, 'string'],
          [/\b(def|defp|defmodule|do|end|if|else|unless|case|cond|when|and|or|not|in|fn|true|false|nil)\b/, 'keyword'],
          [/:[a-z_]+/, 'atom'],
          [/@[a-z_]+/, 'annotation'],
          [/\b\d+\b/, 'number'],
          [/[a-z_][a-z0-9_]*[!?]?/, 'identifier'],
        ],
      },
    });
  };

  // Validate source code
  const validateSource = useCallback((src) => {
    const newErrors = [];
    const newWarnings = [];

    // Basic syntax checks
    if (!src.trim()) {
      newErrors.push('Script source cannot be empty');
    }

    // Check for matching do/end
    const doCount = (src.match(/\bdo\b/g) || []).length;
    const endCount = (src.match(/\bend\b/g) || []).length;
    if (doCount !== endCount) {
      newErrors.push(`Unmatched do/end blocks (${doCount} do, ${endCount} end)`);
    }

    // Warning for no continue/deny/handled
    if (!src.includes('continue()') && !src.includes('deny()') && !src.includes('handled()')) {
      newWarnings.push('Consider calling continue(), deny(), or handled() at the end');
    }

    setErrors(newErrors);
    setWarnings(newWarnings);

    return newErrors.length === 0;
  }, []);

  // Handle source change
  const handleSourceChange = (value) => {
    setSource(value);
    validateSource(value);
  };

  // Run test
  const handleRunTest = useCallback(async () => {
    setIsRunning(true);
    setTestResult(null);

    // Simulate test execution (in real app, would call server)
    setTimeout(() => {
      if (errors.length > 0) {
        setTestResult({ success: false, error: 'Fix validation errors first' });
      } else {
        setTestResult({ success: true, result: ':continue', output: [] });
      }
      setIsRunning(false);
    }, 500);
  }, [errors]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!validateSource(source)) {
      return;
    }

    if (!scriptKey.trim()) {
      setErrors(['Script key is required']);
      return;
    }

    const scriptData = {
      key: scriptKey.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      name: scriptName || scriptKey,
      description,
      hook,
      source,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      entity_key: entityKey || null,
    };

    onSave(scriptData);
  }, [scriptKey, scriptName, description, hook, source, tags, entityKey, validateSource, onSave]);

  return (
    <div className="script-editor-container">
      <div className="script-editor-header">
        <div className="header-row">
          <div className="form-group-inline">
            <label>Key:</label>
            <input
              type="text"
              value={scriptKey}
              onChange={(e) => setScriptKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              className="input-sm"
              placeholder="my_script_name"
            />
          </div>

          <div className="form-group-inline">
            <label>Name:</label>
            <input
              type="text"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              className="input-sm"
              placeholder="Display Name"
            />
          </div>

          <div className="form-group-inline">
            <label>Hook:</label>
            <select
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              className="input-sm"
            >
              {HOOKS.map(h => (
                <option key={h.value} value={h.value} title={h.description}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>

          <div className="header-actions">
            <button onClick={onCancel} className="btn-sm btn-secondary">Cancel</button>
            <button
              onClick={handleSave}
              className="btn-sm btn-success"
              disabled={errors.length > 0}
            >
              Save Script
            </button>
          </div>
        </div>

        <div className="header-row">
          <div className="form-group-inline" style={{ flex: 1 }}>
            <label>Tags:</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input-sm"
              placeholder="npc, combat, greeting"
            />
          </div>

          <div className="form-group-inline">
            <label>Entity:</label>
            <select
              value={entityKey}
              onChange={(e) => setEntityKey(e.target.value)}
              className="input-sm"
            >
              <option value="">None (standalone script)</option>
              {entities.length > 0 && (
                <>
                  <optgroup label="NPCs">
                    {entities.filter(e => e.type === 'npc').map(e => (
                      <option key={e.key} value={e.key}>{e.name} ({e.key})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Rooms">
                    {entities.filter(e => e.type === 'room').map(e => (
                      <option key={e.key} value={e.key}>{e.name} ({e.key})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Items">
                    {entities.filter(e => e.type === 'item').map(e => (
                      <option key={e.key} value={e.key}>{e.name} ({e.key})</option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="script-editor-content">
        <div className="editor-main">
          <Editor
            height="100%"
            defaultLanguage="elixir"
            value={source}
            onChange={handleSourceChange}
            onMount={handleEditorDidMount}
            options={editorOptions}
            theme="vs-dark"
          />
        </div>

        <div className="editor-sidebar">
          <ValidationPanel errors={errors} warnings={warnings} />

          <TestRunnerPanel
            onRunTest={handleRunTest}
            testResult={testResult}
            isRunning={isRunning}
          />

          <div className="sidebar-section">
            <h4>API Reference</h4>
            <APIReferencePanel
              searchQuery={apiSearch}
              onSearchChange={setApiSearch}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
