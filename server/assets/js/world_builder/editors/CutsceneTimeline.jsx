import React, { useState, useCallback, useRef } from 'react';

// ============================================================================
// Keyframe Component
// ============================================================================

const Keyframe = ({ keyframe, index, isSelected, onClick, onDrag, trackHeight }) => {
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

  const getKeyframeColor = (type) => {
    switch (type) {
      case 'dialogue': return '#4a9eff';
      case 'narration': return '#ff9a4a';
      case 'fade_out':
      case 'fade_in': return '#9a4aff';
      case 'pause': return '#6b7280';
      case 'choice': return '#ffd24a';
      case 'sound':
      case 'music': return '#4aff9a';
      default: return '#888';
    }
  };

  const left = keyframe.time * 50; // 50px per second

  return (
    <div
      className={`timeline-keyframe ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${left}px`,
        top: '5px',
        backgroundColor: getKeyframeColor(keyframe.type),
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      title={`${keyframe.type} (${keyframe.time}s)`}
    >
      <span className="keyframe-label">{keyframe.type}</span>
    </div>
  );
};

// ============================================================================
// Timeline Track Component
// ============================================================================

const TimelineTrack = ({ label, keyframes, selectedIndex, onKeyframeClick, onKeyframeDrag }) => {
  const trackHeight = 60;

  return (
    <div className="timeline-track">
      <div className="timeline-track-label">{label}</div>
      <div className="timeline-track-content" style={{ height: `${trackHeight}px` }}>
        {keyframes.map((keyframe, index) => (
          <Keyframe
            key={index}
            keyframe={keyframe}
            index={index}
            isSelected={selectedIndex === index}
            onClick={onKeyframeClick}
            onDrag={onKeyframeDrag}
            trackHeight={trackHeight}
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
        <h4>Keyframe Properties</h4>
        <button onClick={onDelete} className="btn-sm btn-danger">Delete</button>
      </div>

      <div className="form-group">
        <label>Type:</label>
        <select
          value={keyframe.type}
          onChange={(e) => handleChange('type', e.target.value)}
          className="input"
        >
          <option value="dialogue">Dialogue</option>
          <option value="narration">Narration</option>
          <option value="fade_out">Fade Out</option>
          <option value="fade_in">Fade In</option>
          <option value="pause">Pause</option>
          <option value="choice">Choice</option>
          <option value="sound">Sound Effect</option>
          <option value="music">Music</option>
          <option value="animation">Animation</option>
          <option value="apply_status">Apply Status</option>
        </select>
      </div>

      <div className="form-group">
        <label>Time (seconds):</label>
        <input
          type="number"
          value={keyframe.time}
          onChange={(e) => handleChange('time', parseFloat(e.target.value))}
          className="input"
          min="0"
          step="0.1"
        />
      </div>

      {(keyframe.type === 'dialogue' || keyframe.type === 'narration') && (
        <>
          {keyframe.type === 'dialogue' && (
            <div className="form-group">
              <label>Speaker:</label>
              <input
                type="text"
                value={keyframe.speaker || ''}
                onChange={(e) => handleChange('speaker', e.target.value)}
                className="input"
                placeholder="npc_key or 'narrator'"
              />
            </div>
          )}
          <div className="form-group">
            <label>Text:</label>
            <textarea
              value={keyframe.text || ''}
              onChange={(e) => handleChange('text', e.target.value)}
              className="textarea"
              rows="3"
              placeholder="Enter dialogue or narration text..."
            />
          </div>
        </>
      )}

      {(keyframe.type === 'fade_out' || keyframe.type === 'fade_in' || keyframe.type === 'pause') && (
        <div className="form-group">
          <label>Duration (seconds):</label>
          <input
            type="number"
            value={keyframe.duration || 1}
            onChange={(e) => handleChange('duration', parseFloat(e.target.value))}
            className="input"
            min="0.1"
            step="0.1"
          />
        </div>
      )}

      {(keyframe.type === 'sound' || keyframe.type === 'music') && (
        <div className="form-group">
          <label>Audio File:</label>
          <input
            type="text"
            value={keyframe.audio || ''}
            onChange={(e) => handleChange('audio', e.target.value)}
            className="input"
            placeholder="audio_file.mp3"
          />
        </div>
      )}

      {keyframe.type === 'choice' && (
        <>
          <div className="form-group">
            <label>Choice Text:</label>
            <input
              type="text"
              value={keyframe.text || ''}
              onChange={(e) => handleChange('text', e.target.value)}
              className="input"
              placeholder="What will you do?"
            />
          </div>
          <div className="form-group">
            <label>Options (comma-separated):</label>
            <input
              type="text"
              value={keyframe.options || ''}
              onChange={(e) => handleChange('options', e.target.value)}
              className="input"
              placeholder="Option A, Option B, Option C"
            />
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Main CutsceneTimeline Component
// ============================================================================

export default function CutsceneTimeline({ onSave, onCancel, initialData }) {
  const [cutsceneId, setCutsceneId] = useState(initialData?.id || '');
  const [trigger, setTrigger] = useState(initialData?.trigger || { type: 'enter_room', location: '' });
  const [sequence, setSequence] = useState(initialData?.sequence || []);
  const [effects, setEffects] = useState(initialData?.effects || []);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);

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

  const addEffect = useCallback(() => {
    const newEffect = {
      type: 'set_flag',
      flag: '',
    };
    setEffects([...effects, newEffect]);
  }, [effects]);

  const handleSave = useCallback(() => {
    // Sort sequence by time
    const sortedSequence = [...sequence].sort((a, b) => a.time - b.time);

    const cutsceneData = {
      id: cutsceneId,
      trigger,
      sequence: sortedSequence.map(({ time, ...rest }) => rest), // Remove time field for YAML
      effects,
    };

    onSave(cutsceneData);
  }, [cutsceneId, trigger, sequence, effects, onSave]);

  const selectedKeyframe = selectedIndex !== null ? sequence[selectedIndex] : null;
  const maxTime = Math.max(30, ...sequence.map((kf) => kf.time + (kf.duration || 0)));

  return (
    <div className="cutscene-timeline-container">
      <div className="cutscene-timeline-header">
        <div className="header-row">
          <div className="form-group-inline">
            <label>Cutscene ID:</label>
            <input
              type="text"
              value={cutsceneId}
              onChange={(e) => setCutsceneId(e.target.value)}
              className="input-sm"
              placeholder="cutscene_id"
            />
          </div>

          <div className="form-group-inline">
            <label>Trigger Type:</label>
            <select
              value={trigger.type}
              onChange={(e) => setTrigger({ ...trigger, type: e.target.value })}
              className="input-sm"
            >
              <option value="enter_room">Enter Room</option>
              <option value="talk_to">Talk To</option>
              <option value="meditate">Meditate</option>
              <option value="use_item">Use Item</option>
              <option value="quest_complete">Quest Complete</option>
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

        <div className="header-actions">
          <button onClick={onCancel} className="btn-sm btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-sm btn-success">Save Cutscene</button>
        </div>
      </div>

      <div className="cutscene-timeline-content">
        <div className="timeline-sidebar">
          <div className="timeline-controls">
            <h4>Add Keyframe</h4>
            <button onClick={() => addKeyframe('dialogue')} className="btn-sm btn-block">Dialogue</button>
            <button onClick={() => addKeyframe('narration')} className="btn-sm btn-block">Narration</button>
            <button onClick={() => addKeyframe('fade_out')} className="btn-sm btn-block">Fade Out</button>
            <button onClick={() => addKeyframe('fade_in')} className="btn-sm btn-block">Fade In</button>
            <button onClick={() => addKeyframe('pause')} className="btn-sm btn-block">Pause</button>
            <button onClick={() => addKeyframe('choice')} className="btn-sm btn-block">Choice</button>
            <button onClick={() => addKeyframe('sound')} className="btn-sm btn-block">Sound</button>
          </div>
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
