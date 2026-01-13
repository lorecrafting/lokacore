import React, { useState, useCallback, useMemo } from 'react';
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
  const [nodeIdCounter, setNodeIdCounter] = useState(1);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

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

    const questData = {
      key: questKey,
      name: startNode?.data.questName || 'New Quest',
      quest_type: startNode?.data.questType || 'side',
      giver_key: startNode?.data.giverKey || '',
      objectives,
      rewards,
    };

    onSave(questData);
  }, [nodes, questKey, onSave]);

  return (
    <div className="quest-editor-container">
      <div className="quest-editor-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            value={questKey}
            onChange={(e) => setQuestKey(e.target.value)}
            placeholder="quest_key"
            className="input-sm"
            style={{ width: '200px', marginRight: '12px' }}
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
          <button onClick={handleSave} className="btn-sm btn-success">
            Save Quest
          </button>
        </div>
      </div>

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
    </div>
  );
}
