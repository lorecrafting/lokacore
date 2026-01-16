import React from 'react';

/**
 * TemplateCard - Displays a script template card in the picker
 */
export default function TemplateCard({ template, onSelect, isSelected }) {
  // Category colors
  const categoryColors = {
    messages: '#4a9eff',
    navigation: '#4aff9e',
    spawning: '#ff9e4a',
    rewards: '#ffd24a',
    dialogue: '#ff4a9e',
    traps: '#ff4a4a',
    atmosphere: '#9e4aff',
    quests: '#4affff',
    npcs: '#ffcc00',
    death: '#808080',
  };

  const color = categoryColors[template.category] || '#4a9eff';

  return (
    <div
      className={`template-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(template)}
      style={{ borderLeftColor: color }}
    >
      <div className="template-card-header">
        <span className="template-id">{template.id}</span>
        <span className="template-hook" style={{ backgroundColor: color }}>
          {template.hook.replace('_', ' ')}
        </span>
      </div>
      <h4 className="template-name">{template.name}</h4>
      <p className="template-description">{template.description}</p>
    </div>
  );
}
