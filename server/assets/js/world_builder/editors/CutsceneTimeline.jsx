import React, { useState, useCallback, useRef, useMemo } from 'react';

// ============================================================================
// Constants
// ============================================================================

const TRIGGER_TYPES = [
  { value: 'enter_room', label: 'Enter Room' },
  { value: 'talk_to', label: 'Talk To' },
  { value: 'meditate', label: 'Meditate' },
  { value: 'use_item', label: 'Use Item' },
  { value: 'quest_complete', label: 'Quest Complete' },
  { value: 'kill', label: 'Kill Enemy' },
  { value: 'enemy_defeated', label: 'Enemy Defeated' },
];

const STEP_TYPES = [
  { value: 'dialogue', label: 'Dialogue', color: '#4a9eff' },
  { value: 'narration', label: 'Narration', color: '#ff9a4a' },
  { value: 'fade_out', label: 'Fade Out', color: '#9a4aff' },
  { value: 'fade_in', label: 'Fade In', color: '#9a4aff' },
  { value: 'pause', label: 'Pause', color: '#6b7280' },
  { value: 'choice', label: 'Choice', color: '#ffd24a' },
  { value: 'sound', label: 'Sound', color: '#4aff9a' },
  { value: 'music', label: 'Music', color: '#4aff9a' },
  { value: 'animation', label: 'Animation', color: '#ff4a9a' },
  { value: 'spawn_enemy', label: 'Spawn Enemy', color: '#ff4a4a' },
  { value: 'apply_status', label: 'Apply Status', color: '#9aff4a' },
  { value: 'trigger_ending', label: 'Trigger Ending', color: '#ffff4a' },
];

const EFFECT_TYPES = [
  { value: 'set_flag', label: 'Set Flag' },
  { value: 'clear_flag', label: 'Clear Flag' },
  { value: 'add_insight', label: 'Add Insight' },
  { value: 'give_item', label: 'Give Item' },
  { value: 'take_item', label: 'Take Item' },
  { value: 'give_xp', label: 'Give XP' },
  { value: 'give_gold', label: 'Give Gold' },
  { value: 'teleport', label: 'Teleport' },
  { value: 'start_quest', label: 'Start Quest' },
  { value: 'complete_quest', label: 'Complete Quest' },
  { value: 'heal', label: 'Heal' },
  { value: 'damage', label: 'Damage' },
  { value: 'add_status', label: 'Add Status' },
  { value: 'start_combat', label: 'Start Combat' },
];

const VIRTUAL_SPEAKERS = [
  'mysterious_voice', 'narrator', 'inner_voice', 'system', 'player',
  'raga_voice', 'dvesha_voice', 'moha_voice', 'mara', 'lama_tenzin'
];

// ============================================================================
// Validation Functions
// ============================================================================

function validateCutscene(cutscene) {
  const errors = [];
  const warnings = [];

  // Check ID
  if (!cutscene.id || cutscene.id.trim() === '') {
    errors.push('Cutscene ID is required');
  } else if (!/^[a-z0-9_-]+$/.test(cutscene.id)) {
    errors.push('Cutscene ID must be snake_case (lowercase, numbers, underscores, hyphens)');
  }

  // Check trigger
  if (cutscene.trigger?.type === 'enter_room' && !cutscene.trigger?.location) {
    errors.push('Location is required for enter_room trigger');
  }

  // Check sequence
  if (!cutscene.sequence || cutscene.sequence.length === 0) {
    warnings.push('Cutscene has no sequence steps');
  } else {
    cutscene.sequence.forEach((step, index) => {
      if (step.type === 'dialogue' && !step.text) {
        errors.push(`Step ${index + 1}: Dialogue requires text`);
      }
      if (step.type === 'dialogue' && !step.speaker) {
        warnings.push(`Step ${index + 1}: Dialogue has no speaker`);
      }
      if (step.type === 'narration' && !step.text) {
        errors.push(`Step ${index + 1}: Narration requires text`);
      }
    });
  }

  return { errors, warnings, isValid: errors.length === 0 };
}

// ============================================================================
// Keyframe Component
// ============================================================================

const Keyframe = ({ keyframe, index, isSelected, onClick, onDrag }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);

  const handleMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartTime.current = keyframe.time;
    onClick(index);
  };

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStartX.current;
      const deltaTime = deltaX / 50; // 50px per second
      const newTime = Math.max(0, dragStartTime.current + deltaTime);
      onDrag(index, newTime);
    }
  }, [isDragging, index, onDrag]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const typeConfig = STEP_TYPES.find(t => t.value === keyframe.type) || { color: '#888' };
  const left = keyframe.time * 50; // 50px per second

  return (
    <div
      className={`timeline-keyframe ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${left}px`,
        top: '5px',
        backgroundColor: typeConfig.color,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      title={`${keyframe.type} (${keyframe.time.toFixed(1)}s)`}
    >
      <span className="keyframe-label">{keyframe.type}</span>
    </div>
  );
};

// ============================================================================
// Timeline Track Component
// ============================================================================

const TimelineTrack = ({ label, keyframes, selectedIndex, onKeyframeClick, onKeyframeDrag }) => {
  return (
    <div className="timeline-track">
      <div className="timeline-track-label">{label}</div>
      <div className="timeline-track-content">
        {keyframes.map((keyframe, index) => (
          <Keyframe
            key={index}
            keyframe={keyframe}
            index={index}
            isSelected={selectedIndex === index}
            onClick={onKeyframeClick}
            onDrag={onKeyframeDrag}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Keyframe Properties Panel
// ============================================================================

const KeyframeProperties = ({ keyframe, onUpdate, onDelete }) => {
  if (!keyframe) {
    return (
      <div className="keyframe-properties-empty">
        <p>Select a keyframe to edit its properties</p>
      </div>
    );
  }

  const handleChange = (field, value) => {
    onUpdate({ ...keyframe, [field]: value });
  };

  return (
    <div className="keyframe-properties">
      <div className="properties-header">
        <h4>Step Properties</h4>
        <button onClick={onDelete} className="btn-sm btn-danger">Delete</button>
      </div>

      <div className="form-group">
        <label>Type:</label>
        <select
          value={keyframe.type}
          onChange={(e) => handleChange('type', e.target.value)}
          className="input"
        >
          {STEP_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Time (seconds):</label>
        <input
          type="number"
          value={keyframe.time}
          onChange={(e) => handleChange('time', parseFloat(e.target.value) || 0)}
          className="input"
          min="0"
          step="0.1"
        />
      </div>

      {keyframe.type === 'dialogue' && (
        <>
          <div className="form-group">
            <label>Speaker:</label>
            <input
              type="text"
              value={keyframe.speaker || ''}
              onChange={(e) => handleChange('speaker', e.target.value)}
              className="input"
              placeholder="npc_key or narrator"
              list="virtual-speakers"
            />
            <datalist id="virtual-speakers">
              {VIRTUAL_SPEAKERS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label>Text:</label>
            <textarea
              value={keyframe.text || ''}
              onChange={(e) => handleChange('text', e.target.value)}
              className="textarea"
              rows="3"
              placeholder="Enter dialogue text..."
            />
          </div>
        </>
      )}

      {keyframe.type === 'narration' && (
        <div className="form-group">
          <label>Text:</label>
          <textarea
            value={keyframe.text || ''}
            onChange={(e) => handleChange('text', e.target.value)}
            className="textarea"
            rows="3"
            placeholder="Enter narration text..."
          />
        </div>
      )}

      {(keyframe.type === 'fade_out' || keyframe.type === 'fade_in' || keyframe.type === 'pause') && (
        <div className="form-group">
          <label>Duration (seconds):</label>
          <input
            type="number"
            value={keyframe.duration || 1}
            onChange={(e) => handleChange('duration', parseFloat(e.target.value) || 1)}
            className="input"
            min="0.1"
            step="0.1"
          />
        </div>
      )}

      {(keyframe.type === 'sound' || keyframe.type === 'music') && (
        <div className="form-group">
          <label>{keyframe.type === 'music' ? 'Track:' : 'Audio:'}</label>
          <input
            type="text"
            value={keyframe.audio || keyframe.track || ''}
            onChange={(e) => handleChange(keyframe.type === 'music' ? 'track' : 'audio', e.target.value)}
            className="input"
            placeholder="audio_file_key"
          />
        </div>
      )}

      {keyframe.type === 'choice' && (
        <>
          <div className="form-group">
            <label>Prompt:</label>
            <input
              type="text"
              value={keyframe.prompt || ''}
              onChange={(e) => handleChange('prompt', e.target.value)}
              className="input"
              placeholder="What will you do?"
            />
          </div>
          <div className="form-group">
            <label>Options (JSON):</label>
            <textarea
              value={JSON.stringify(keyframe.options || [], null, 2)}
              onChange={(e) => {
                try {
                  handleChange('options', JSON.parse(e.target.value));
                } catch {}
              }}
              className="textarea"
              rows="4"
              placeholder='[{"id": "opt1", "text": "Option 1"}]'
            />
          </div>
        </>
      )}

      {keyframe.type === 'spawn_enemy' && (
        <>
          <div className="form-group">
            <label>Enemy Key:</label>
            <input
              type="text"
              value={keyframe.enemy || ''}
              onChange={(e) => handleChange('enemy', e.target.value)}
              className="input"
              placeholder="enemy_npc_key"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={keyframe.hostile !== false}
                onChange={(e) => handleChange('hostile', e.target.checked)}
              />
              Hostile
            </label>
          </div>
        </>
      )}

      {keyframe.type === 'apply_status' && (
        <>
          <div className="form-group">
            <label>Status:</label>
            <input
              type="text"
              value={keyframe.status || ''}
              onChange={(e) => handleChange('status', e.target.value)}
              className="input"
              placeholder="status_key"
            />
          </div>
          <div className="form-group">
            <label>Duration (seconds):</label>
            <input
              type="number"
              value={keyframe.duration || 10}
              onChange={(e) => handleChange('duration', parseFloat(e.target.value) || 10)}
              className="input"
              min="1"
            />
          </div>
        </>
      )}

      {keyframe.type === 'trigger_ending' && (
        <div className="form-group">
          <label>Ending ID:</label>
          <input
            type="text"
            value={keyframe.ending || ''}
            onChange={(e) => handleChange('ending', e.target.value)}
            className="input"
            placeholder="ending_id"
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Effects Panel Component
// ============================================================================

const EffectsPanel = ({ effects, onChange }) => {
  const addEffect = () => {
    onChange([...effects, { type: 'set_flag', flag: '' }]);
  };

  const updateEffect = (index, updated) => {
    onChange(effects.map((e, i) => i === index ? updated : e));
  };

  const deleteEffect = (index) => {
    onChange(effects.filter((_, i) => i !== index));
  };

  return (
    <div className="effects-panel">
      <div className="effects-header">
        <h4>Effects (Applied on Complete)</h4>
        <button onClick={addEffect} className="btn-sm btn-primary">+ Add</button>
      </div>

      {effects.length === 0 ? (
        <p className="effects-empty">No effects defined</p>
      ) : (
        <div className="effects-list">
          {effects.map((effect, index) => (
            <div key={index} className="effect-item">
              <select
                value={effect.type}
                onChange={(e) => updateEffect(index, { ...effect, type: e.target.value })}
                className="input-sm"
              >
                {EFFECT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {(effect.type === 'set_flag' || effect.type === 'clear_flag') && (
                <input
                  type="text"
                  value={effect.flag || ''}
                  onChange={(e) => updateEffect(index, { ...effect, flag: e.target.value })}
                  className="input-sm"
                  placeholder="flag_name"
                />
              )}

              {(effect.type === 'give_item' || effect.type === 'take_item') && (
                <>
                  <input
                    type="text"
                    value={effect.item || ''}
                    onChange={(e) => updateEffect(index, { ...effect, item: e.target.value })}
                    className="input-sm"
                    placeholder="item_key"
                  />
                  <input
                    type="number"
                    value={effect.quantity || 1}
                    onChange={(e) => updateEffect(index, { ...effect, quantity: parseInt(e.target.value) || 1 })}
                    className="input-sm"
                    style={{ width: '60px' }}
                    min="1"
                  />
                </>
              )}

              {(effect.type === 'add_insight' || effect.type === 'give_xp' || effect.type === 'give_gold' || effect.type === 'heal' || effect.type === 'damage') && (
                <input
                  type="number"
                  value={effect.amount || 1}
                  onChange={(e) => updateEffect(index, { ...effect, amount: parseInt(e.target.value) || 1 })}
                  className="input-sm"
                  style={{ width: '80px' }}
                  placeholder="amount"
                />
              )}

              {effect.type === 'teleport' && (
                <input
                  type="text"
                  value={effect.location || ''}
                  onChange={(e) => updateEffect(index, { ...effect, location: e.target.value })}
                  className="input-sm"
                  placeholder="room_key"
                />
              )}

              {(effect.type === 'start_quest' || effect.type === 'complete_quest') && (
                <input
                  type="text"
                  value={effect.quest_key || ''}
                  onChange={(e) => updateEffect(index, { ...effect, quest_key: e.target.value })}
                  className="input-sm"
                  placeholder="quest_key"
                />
              )}

              {effect.type === 'add_status' && (
                <>
                  <input
                    type="text"
                    value={effect.status || ''}
                    onChange={(e) => updateEffect(index, { ...effect, status: e.target.value })}
                    className="input-sm"
                    placeholder="status_key"
                  />
                  <input
                    type="number"
                    value={effect.duration || 10}
                    onChange={(e) => updateEffect(index, { ...effect, duration: parseInt(e.target.value) || 10 })}
                    className="input-sm"
                    style={{ width: '60px' }}
                    placeholder="duration"
                  />
                </>
              )}

              {effect.type === 'start_combat' && (
                <input
                  type="text"
                  value={effect.enemy || ''}
                  onChange={(e) => updateEffect(index, { ...effect, enemy: e.target.value })}
                  className="input-sm"
                  placeholder="enemy_key"
                />
              )}

              <button
                onClick={() => deleteEffect(index)}
                className="btn-sm btn-danger"
                title="Remove effect"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Validation Display Component
// ============================================================================

const ValidationDisplay = ({ validation }) => {
  if (validation.isValid && validation.warnings.length === 0) {
    return (
      <div className="validation-display valid">
        <span className="validation-icon">✓</span>
        <span>Valid</span>
      </div>
    );
  }

  return (
    <div className="validation-display">
      {validation.errors.length > 0 && (
        <div className="validation-errors">
          {validation.errors.map((error, i) => (
            <div key={i} className="validation-error">⚠ {error}</div>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="validation-warnings">
          {validation.warnings.map((warning, i) => (
            <div key={i} className="validation-warning">⚡ {warning}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Preview Panel Component
// ============================================================================

const PreviewPanel = ({ sequence, isPlaying, currentStep, onPlay, onStop, onStepClick }) => {
  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h4>Preview</h4>
        <div className="preview-controls">
          {isPlaying ? (
            <button onClick={onStop} className="btn-sm">⏹ Stop</button>
          ) : (
            <button onClick={onPlay} className="btn-sm btn-primary">▶ Play</button>
          )}
        </div>
      </div>
      <div className="preview-content">
        {sequence.length === 0 ? (
          <p className="preview-empty">Add steps to preview</p>
        ) : (
          <div className="preview-steps">
            {sequence.map((step, index) => (
              <div
                key={index}
                className={`preview-step ${currentStep === index ? 'active' : ''}`}
                onClick={() => onStepClick(index)}
              >
                <span className="step-number">{index + 1}</span>
                <span className="step-type">{step.type}</span>
                <span className="step-text">{step.text?.substring(0, 30) || step.speaker || '...'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main CutsceneTimeline Component
// ============================================================================

export default function CutsceneTimeline({ onSave, onCancel, initialData }) {
  const [cutsceneId, setCutsceneId] = useState(initialData?.id || '');
  const [cutsceneName, setCutsceneName] = useState(initialData?.name || '');
  const [trigger, setTrigger] = useState(initialData?.trigger || { type: 'enter_room', location: '', condition: '' });
  const [sequence, setSequence] = useState(
    (initialData?.sequence || []).map((s, i) => ({ ...s, time: i * 2 }))
  );
  const [effects, setEffects] = useState(initialData?.effects || []);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const playIntervalRef = useRef(null);

  // Validation
  const validation = useMemo(() => {
    return validateCutscene({
      id: cutsceneId,
      trigger,
      sequence,
      effects,
    });
  }, [cutsceneId, trigger, sequence, effects]);

  const addKeyframe = useCallback((type) => {
    const newKeyframe = {
      type,
      time: currentTime,
      text: '',
      speaker: '',
      duration: 1.0,
    };
    setSequence([...sequence, newKeyframe]);
    setSelectedIndex(sequence.length);
  }, [sequence, currentTime]);

  const updateKeyframe = useCallback((updatedKeyframe) => {
    setSequence((seq) =>
      seq.map((kf, idx) => (idx === selectedIndex ? updatedKeyframe : kf))
    );
  }, [selectedIndex]);

  const deleteKeyframe = useCallback(() => {
    setSequence((seq) => seq.filter((_, idx) => idx !== selectedIndex));
    setSelectedIndex(null);
  }, [selectedIndex]);

  const handleKeyframeDrag = useCallback((index, newTime) => {
    setSequence((seq) =>
      seq.map((kf, idx) => (idx === index ? { ...kf, time: newTime } : kf))
    );
  }, []);

  // Preview controls
  const handlePlay = useCallback(() => {
    if (sequence.length === 0) return;
    setIsPlaying(true);
    setCurrentStep(0);

    const sorted = [...sequence].sort((a, b) => a.time - b.time);
    let stepIndex = 0;

    playIntervalRef.current = setInterval(() => {
      stepIndex++;
      if (stepIndex >= sorted.length) {
        setIsPlaying(false);
        setCurrentStep(-1);
        clearInterval(playIntervalRef.current);
      } else {
        setCurrentStep(stepIndex);
      }
    }, 2000); // 2 seconds per step for preview
  }, [sequence]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(-1);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
  }, []);

  const handleSave = useCallback(() => {
    // Sort sequence by time and remove time field for YAML
    const sortedSequence = [...sequence]
      .sort((a, b) => a.time - b.time)
      .map(({ time, ...rest }) => rest);

    const cutsceneData = {
      id: cutsceneId,
      name: cutsceneName || cutsceneId,
      trigger: {
        type: trigger.type,
        ...(trigger.location && { location: trigger.location }),
        ...(trigger.condition && { condition: trigger.condition }),
      },
      sequence: sortedSequence,
      effects,
    };

    onSave(cutsceneData);
  }, [cutsceneId, cutsceneName, trigger, sequence, effects, onSave]);

  const selectedKeyframe = selectedIndex !== null ? sequence[selectedIndex] : null;
  const maxTime = Math.max(30, ...sequence.map((kf) => kf.time + (kf.duration || 0)));

  return (
    <div className="cutscene-timeline-container">
      <div className="cutscene-timeline-header">
        <div className="header-row">
          <div className="form-group-inline">
            <label>ID:</label>
            <input
              type="text"
              value={cutsceneId}
              onChange={(e) => setCutsceneId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
              className="input-sm"
              placeholder="cutscene_id"
            />
          </div>

          <div className="form-group-inline">
            <label>Name:</label>
            <input
              type="text"
              value={cutsceneName}
              onChange={(e) => setCutsceneName(e.target.value)}
              className="input-sm"
              placeholder="Display Name"
            />
          </div>

          <div className="form-group-inline">
            <label>Trigger:</label>
            <select
              value={trigger.type}
              onChange={(e) => setTrigger({ ...trigger, type: e.target.value })}
              className="input-sm"
            >
              {TRIGGER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group-inline">
            <label>Location:</label>
            <input
              type="text"
              value={trigger.location || ''}
              onChange={(e) => setTrigger({ ...trigger, location: e.target.value })}
              className="input-sm"
              placeholder="room_key or npc_key"
            />
          </div>
        </div>

        <div className="header-row">
          <div className="form-group-inline" style={{ flex: 1 }}>
            <label>Condition:</label>
            <input
              type="text"
              value={trigger.condition || ''}
              onChange={(e) => setTrigger({ ...trigger, condition: e.target.value })}
              className="input-sm"
              style={{ width: '300px' }}
              placeholder="!player.has_flag('seen_cutscene')"
            />
          </div>

          <ValidationDisplay validation={validation} />

          <div className="header-actions">
            <button onClick={onCancel} className="btn-sm btn-secondary">Cancel</button>
            <button
              onClick={handleSave}
              className="btn-sm btn-success"
              disabled={!validation.isValid}
            >
              Save Cutscene
            </button>
          </div>
        </div>
      </div>

      <div className="cutscene-timeline-content">
        <div className="timeline-sidebar">
          <div className="timeline-controls">
            <h4>Add Step</h4>
            {STEP_TYPES.slice(0, 6).map(t => (
              <button
                key={t.value}
                onClick={() => addKeyframe(t.value)}
                className="btn-sm btn-block"
                style={{ borderLeft: `3px solid ${t.color}` }}
              >
                {t.label}
              </button>
            ))}
            <details>
              <summary className="more-types">More Types...</summary>
              {STEP_TYPES.slice(6).map(t => (
                <button
                  key={t.value}
                  onClick={() => addKeyframe(t.value)}
                  className="btn-sm btn-block"
                  style={{ borderLeft: `3px solid ${t.color}` }}
                >
                  {t.label}
                </button>
              ))}
            </details>
          </div>

          <EffectsPanel effects={effects} onChange={setEffects} />
        </div>

        <div className="timeline-main">
          <div className="timeline-ruler">
            {Array.from({ length: Math.ceil(maxTime) + 1 }).map((_, i) => (
              <div key={i} className="timeline-marker" style={{ left: `${i * 50}px` }}>
                <span>{i}s</span>
              </div>
            ))}
          </div>

          <TimelineTrack
            label="Sequence"
            keyframes={sequence}
            selectedIndex={selectedIndex}
            onKeyframeClick={setSelectedIndex}
            onKeyframeDrag={handleKeyframeDrag}
          />

          <PreviewPanel
            sequence={sequence}
            isPlaying={isPlaying}
            currentStep={currentStep}
            onPlay={handlePlay}
            onStop={handleStop}
            onStepClick={setSelectedIndex}
          />
        </div>

        <div className="timeline-properties-panel">
          <KeyframeProperties
            keyframe={selectedKeyframe}
            onUpdate={updateKeyframe}
            onDelete={deleteKeyframe}
          />
        </div>
      </div>
    </div>
  );
}
