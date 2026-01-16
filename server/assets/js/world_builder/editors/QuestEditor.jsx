import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ============================================================================
// Validation Utilities
// ============================================================================

const validateQuest = (nodes, questKey) => {
  const errors = [];
  const warnings = [];

  // Check quest key
  if (!questKey || questKey.trim() === '') {
    errors.push('Quest key is required');
  } else if (!/^[a-z][a-z0-9_]*$/.test(questKey)) {
    errors.push('Quest key must be snake_case (lowercase, underscores)');
  }

  // Check start node
  const startNode = nodes.find(n => n.type === 'startNode');
  if (startNode) {
    if (!startNode.data.questName) {
      errors.push('Quest name is required');
    }
    if (!startNode.data.giverKey) {
      warnings.push('No giver NPC specified');
    }
  }

  // Check objectives
  const objectiveNodes = nodes.filter(n => n.type === 'objectiveNode');
  if (objectiveNodes.length === 0) {
    errors.push('Quest must have at least one objective');
  }
  objectiveNodes.forEach((node, idx) => {
    if (!node.data.target) {
      errors.push(`Objective ${idx + 1}: target is required`);
    }
    if (!node.data.description) {
      warnings.push(`Objective ${idx + 1}: description is recommended`);
    }
  });

  // Check end node
  const endNode = nodes.find(n => n.type === 'endNode');
  if (!endNode) {
    warnings.push('No end node - quest will not have a completion point');
  }

  return { errors, warnings };
};

// ============================================================================
// Custom Node Components
// ============================================================================

const StartNode = ({ data }) => {
  return (
    <div className="quest-node quest-node-start">
      <Handle type="source" position={Position.Bottom} />
      <div className="quest-node-header">START</div>
      <div className="quest-node-body">
        <div className="form-group-sm">
          <label>Quest Name:</label>
          <input
            type="text"
            value={data.questName || ''}
            onChange={(e) => data.onChange('questName', e.target.value)}
            className="input-sm"
            placeholder="Enter quest name"
          />
        </div>
        <div className="form-group-sm">
          <label>Quest Type:</label>
          <select
            value={data.questType || 'side'}
            onChange={(e) => data.onChange('questType', e.target.value)}
            className="input-sm"
          >
            <option value="main">Main Quest</option>
            <option value="side">Side Quest</option>
            <option value="daily">Daily Quest</option>
            <option value="repeatable">Repeatable</option>
          </select>
        </div>
        <div className="form-group-sm">
          <label>Giver NPC:</label>
          <input
            type="text"
            value={data.giverKey || ''}
            onChange={(e) => data.onChange('giverKey', e.target.value)}
            className="input-sm"
            placeholder="npc_key"
          />
        </div>
      </div>
    </div>
  );
};

const ObjectiveNode = ({ data }) => {
  return (
    <div className="quest-node quest-node-objective">
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div className="quest-node-header">OBJECTIVE</div>
      <div className="quest-node-body">
        <div className="form-group-sm">
          <label>Type:</label>
          <select
            value={data.objectiveType || 'kill'}
            onChange={(e) => data.onChange('objectiveType', e.target.value)}
            className="input-sm"
          >
            <option value="kill">Kill Enemy</option>
            <option value="collect">Collect Item</option>
            <option value="talk_to">Talk to NPC</option>
            <option value="reach_room">Reach Location</option>
            <option value="use_item">Use Item</option>
            <option value="explore">Explore Area</option>
          </select>
        </div>
        <div className="form-group-sm">
          <label>Target:</label>
          <input
            type="text"
            value={data.target || ''}
            onChange={(e) => data.onChange('target', e.target.value)}
            className="input-sm"
            placeholder="entity_key"
          />
        </div>
        {['kill', 'collect'].includes(data.objectiveType) && (
          <div className="form-group-sm">
            <label>Count:</label>
            <input
              type="number"
              value={data.count || 1}
              onChange={(e) => data.onChange('count', parseInt(e.target.value))}
              className="input-sm"
              min="1"
            />
          </div>
        )}
        <div className="form-group-sm">
          <label>Description:</label>
          <input
            type="text"
            value={data.description || ''}
            onChange={(e) => data.onChange('description', e.target.value)}
            className="input-sm"
            placeholder="Player-facing description"
          />
        </div>
      </div>
    </div>
  );
};

const ChoiceNode = ({ data }) => {
  return (
    <div className="quest-node quest-node-choice">
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="a" style={{ left: '33%' }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ left: '66%' }} />
      <div className="quest-node-header">CHOICE</div>
      <div className="quest-node-body">
        <div className="form-group-sm">
          <label>Choice Text:</label>
          <input
            type="text"
            value={data.choiceText || ''}
            onChange={(e) => data.onChange('choiceText', e.target.value)}
            className="input-sm"
            placeholder="What will you do?"
          />
        </div>
        <div className="form-group-sm">
          <label>Option A:</label>
          <input
            type="text"
            value={data.optionA || ''}
            onChange={(e) => data.onChange('optionA', e.target.value)}
            className="input-sm"
            placeholder="First option"
          />
        </div>
        <div className="form-group-sm">
          <label>Option B:</label>
          <input
            type="text"
            value={data.optionB || ''}
            onChange={(e) => data.onChange('optionB', e.target.value)}
            className="input-sm"
            placeholder="Second option"
          />
        </div>
      </div>
    </div>
  );
};

const RewardNode = ({ data }) => {
  return (
    <div className="quest-node quest-node-reward">
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div className="quest-node-header">REWARD</div>
      <div className="quest-node-body">
        <div className="form-group-sm">
          <label>XP:</label>
          <input
            type="number"
            value={data.xp || 0}
            onChange={(e) => data.onChange('xp', parseInt(e.target.value))}
            className="input-sm"
            min="0"
          />
        </div>
        <div className="form-group-sm">
          <label>Gold:</label>
          <input
            type="number"
            value={data.gold || 0}
            onChange={(e) => data.onChange('gold', parseInt(e.target.value))}
            className="input-sm"
            min="0"
          />
        </div>
        <div className="form-group-sm">
          <label>Items (comma-separated):</label>
          <input
            type="text"
            value={data.items || ''}
            onChange={(e) => data.onChange('items', e.target.value)}
            className="input-sm"
            placeholder="item_key1, item_key2"
          />
        </div>
      </div>
    </div>
  );
};

const EndNode = ({ data }) => {
  return (
    <div className="quest-node quest-node-end">
      <Handle type="target" position={Position.Top} />
      <div className="quest-node-header">END</div>
      <div className="quest-node-body">
        <div className="quest-complete-badge">Quest Complete</div>
      </div>
    </div>
  );
};

// ============================================================================
// Validation Panel Component
// ============================================================================

const ValidationPanel = ({ errors, warnings }) => {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="quest-validation-panel valid">
        <span className="validation-icon">✓</span>
        <span>Quest is valid</span>
      </div>
    );
  }

  return (
    <div className="quest-validation-panel">
      {errors.length > 0 && (
        <div className="validation-errors">
          {errors.map((err, i) => (
            <div key={`e-${i}`} className="validation-error">
              <span className="validation-icon">✗</span>
              {err}
            </div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="validation-warnings">
          {warnings.map((warn, i) => (
            <div key={`w-${i}`} className="validation-warning">
              <span className="validation-icon">⚠</span>
              {warn}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Prerequisites Panel Component
// ============================================================================

const PrerequisitesPanel = ({ prerequisites, onAdd, onRemove, onChange }) => {
  return (
    <div className="quest-prerequisites-panel">
      <div className="panel-header">
        <h4>Prerequisites</h4>
        <button onClick={onAdd} className="btn-sm btn-primary">+ Add</button>
      </div>
      {prerequisites.length === 0 ? (
        <div className="prerequisites-empty">No prerequisites</div>
      ) : (
        <div className="prerequisites-list">
          {prerequisites.map((prereq, idx) => (
            <div key={idx} className="prerequisite-item">
              <select
                value={prereq.type || 'quest'}
                onChange={(e) => onChange(idx, 'type', e.target.value)}
                className="input-sm"
              >
                <option value="quest">Complete Quest</option>
                <option value="level">Minimum Level</option>
                <option value="item">Has Item</option>
                <option value="flag">Has Flag</option>
              </select>
              <input
                type={prereq.type === 'level' ? 'number' : 'text'}
                value={prereq.value || ''}
                onChange={(e) => onChange(idx, 'value', prereq.type === 'level' ? parseInt(e.target.value) : e.target.value)}
                className="input-sm"
                placeholder={prereq.type === 'level' ? '1' : 'key'}
              />
              <button
                onClick={() => onRemove(idx)}
                className="btn-sm btn-danger"
                title="Remove"
              >
                ✗
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main QuestEditor Component
// ============================================================================

const initialNodes = [
  {
    id: 'start',
    type: 'startNode',
    data: {
      questName: '',
      questType: 'side',
      giverKey: '',
      onChange: () => {}
    },
    position: { x: 250, y: 25 },
  },
];

const initialEdges = [];

const nodeTypes = {
  startNode: StartNode,
  objectiveNode: ObjectiveNode,
  choiceNode: ChoiceNode,
  rewardNode: RewardNode,
  endNode: EndNode,
};

export default function QuestEditor({ onSave, onCancel, initialData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [questKey, setQuestKey] = useState(initialData?.key || '');
  const [questDescription, setQuestDescription] = useState(initialData?.description || '');
  const [prerequisites, setPrerequisites] = useState(initialData?.prerequisites || []);
  const [levelRange, setLevelRange] = useState(initialData?.level_range || { min: 1, max: 99 });
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const [validation, setValidation] = useState({ errors: [], warnings: [] });

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Run validation whenever nodes or questKey changes
  useEffect(() => {
    setValidation(validateQuest(nodes, questKey));
  }, [nodes, questKey]);

  // Prerequisites handlers
  const addPrerequisite = useCallback(() => {
    setPrerequisites(prev => [...prev, { type: 'quest', value: '' }]);
  }, []);

  const removePrerequisite = useCallback((idx) => {
    setPrerequisites(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updatePrerequisite = useCallback((idx, field, value) => {
    setPrerequisites(prev => prev.map((p, i) =>
      i === idx ? { ...p, [field]: value } : p
    ));
  }, []);

  // Update node data
  const updateNodeData = useCallback((nodeId, field, value) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              [field]: value,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Inject onChange handlers into nodes
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onChange: (field, value) => updateNodeData(node.id, field, value),
      },
    }));
  }, [nodes, updateNodeData]);

  const addNode = useCallback((type) => {
    const newId = `node_${nodeIdCounter}`;
    setNodeIdCounter(nodeIdCounter + 1);

    const newNode = {
      id: newId,
      type,
      data: {},
      position: { x: 250 + Math.random() * 100, y: 100 + nodeIdCounter * 80 },
    };

    setNodes((nds) => [...nds, newNode]);
  }, [nodeIdCounter, setNodes]);

  const handleSave = useCallback(() => {
    // Run final validation
    const finalValidation = validateQuest(nodes, questKey);
    if (finalValidation.errors.length > 0) {
      setValidation(finalValidation);
      return;
    }

    // Extract quest data from nodes
    const startNode = nodes.find((n) => n.type === 'startNode');
    const objectiveNodes = nodes.filter((n) => n.type === 'objectiveNode');
    const rewardNodes = nodes.filter((n) => n.type === 'rewardNode');

    // Build objectives array
    const objectives = objectiveNodes.map((node, idx) => ({
      id: `obj_${idx + 1}`,
      type: node.data.objectiveType || 'kill',
      target: node.data.target || '',
      count: node.data.count || 1,
      description: node.data.description || '',
    }));

    // Build rewards object
    const rewards = rewardNodes.reduce((acc, node) => {
      if (node.data.xp) acc.xp = (acc.xp || 0) + node.data.xp;
      if (node.data.gold) acc.gold = (acc.gold || 0) + node.data.gold;
      if (node.data.items) {
        const items = node.data.items.split(',').map((s) => s.trim()).filter(Boolean);
        acc.items = [...(acc.items || []), ...items];
      }
      return acc;
    }, {});

    // Filter valid prerequisites
    const validPrerequisites = prerequisites.filter(p => p.value && p.value.toString().trim() !== '');

    const questData = {
      key: questKey,
      name: startNode?.data.questName || 'New Quest',
      description: questDescription,
      quest_type: startNode?.data.questType || 'side',
      giver_key: startNode?.data.giverKey || '',
      objectives,
      rewards,
      prerequisites: validPrerequisites,
      level_range: levelRange,
    };

    onSave(questData);
  }, [nodes, questKey, questDescription, prerequisites, levelRange, onSave]);

  return (
    <div className="quest-editor-container">
      <div className="quest-editor-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            value={questKey}
            onChange={(e) => setQuestKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            placeholder="quest_key"
            className="input-sm"
            style={{ width: '180px', marginRight: '8px' }}
          />
          <button onClick={() => addNode('objectiveNode')} className="btn-sm btn-primary">
            + Objective
          </button>
          <button onClick={() => addNode('choiceNode')} className="btn-sm btn-primary">
            + Choice
          </button>
          <button onClick={() => addNode('rewardNode')} className="btn-sm btn-primary">
            + Reward
          </button>
          <button onClick={() => addNode('endNode')} className="btn-sm btn-primary">
            + End
          </button>
        </div>
        <div className="toolbar-right">
          <button onClick={onCancel} className="btn-sm btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-sm btn-success"
            disabled={validation.errors.length > 0}
          >
            Save Quest
          </button>
        </div>
      </div>

      <div className="quest-editor-main">
        <div className="quest-editor-canvas">
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </div>

        <div className="quest-editor-sidebar">
          <ValidationPanel errors={validation.errors} warnings={validation.warnings} />

          <div className="quest-details-panel">
            <h4>Quest Details</h4>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={questDescription}
                onChange={(e) => setQuestDescription(e.target.value)}
                placeholder="Quest description shown to player..."
                className="textarea"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Level Range</label>
              <div className="level-range-inputs">
                <input
                  type="number"
                  value={levelRange.min}
                  onChange={(e) => setLevelRange(prev => ({ ...prev, min: parseInt(e.target.value) || 1 }))}
                  className="input-sm"
                  min="1"
                  placeholder="Min"
                />
                <span>to</span>
                <input
                  type="number"
                  value={levelRange.max}
                  onChange={(e) => setLevelRange(prev => ({ ...prev, max: parseInt(e.target.value) || 99 }))}
                  className="input-sm"
                  min="1"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>

          <PrerequisitesPanel
            prerequisites={prerequisites}
            onAdd={addPrerequisite}
            onRemove={removePrerequisite}
            onChange={updatePrerequisite}
          />
        </div>
      </div>
    </div>
  );
}
