// A full reading page with the offered actions following its combat history.
import { ScrollView, Text } from 'react-native';
import { bleedingLine, type group } from './model.ts';
import { Act, titleFocus, titleStyle } from './pages.tsx';
import { prose, usePalette } from './palette.ts';
import type { presenter, Button } from './presenter.ts';

export function Combat(p: {
  screen: ReturnType<ReturnType<typeof presenter>['screen']>;
  g: ReturnType<typeof group>;
  press: (button: Button) => void;
}) {
  const c = usePalette();
  const { view, text, combatLog } = p.screen;
  if (!view.combat) return null;
  const stand = p.g.position.find((b) => b.action_key === 'stand');
  return (
    <ScrollView style={{ backgroundColor: c.bg, flex: 1 }} contentContainerStyle={{ padding: 24 }}>
      <Text {...titleFocus} accessibilityRole="header" style={titleStyle(c)}>
        Combat
      </Text>
      <Text style={prose(c)}>{text(view.combat.name)}</Text>
      {view.bleeding && (
        <Text style={prose(c)}>{bleedingLine(view.bleeding, view.time, text)}</Text>
      )}
      {view.combat.active_opponents?.map((opponent) => (
        <Text key={opponent.id} style={prose(c)}>
          {text(opponent.name)}
          {opponent.id === view.combat!.opponent_id ? ' (your target)' : ''}
        </Text>
      ))}
      {combatLog.map((line, i) => (
        <Text key={i} style={prose(c)}>
          {line}
        </Text>
      ))}
      {stand && <Act b={stand} press={p.press} />}
      {p.g.look && <Act b={p.g.look} press={p.press} />}
      {p.g.flee.map((b) => (
        <Act key={b.label} b={b} press={p.press} />
      ))}
      {p.g.bandage.map((b) => (
        <Act key={b.target_ids[0]} b={b} press={p.press} />
      ))}
    </ScrollView>
  );
}
