// A full reading page with the offered actions following its combat history.
import { ScrollView, Text } from 'react-native';
import type { group } from './model.ts';
import { Act, prose, scrollPaper, titleStyle } from './pages.tsx';
import type { presenter, Button } from './presenter.ts';

export function Combat(p: {
  screen: ReturnType<ReturnType<typeof presenter>['screen']>;
  g: ReturnType<typeof group>;
  press: (button: Button) => void;
}) {
  const { view, text, combatLog } = p.screen;
  if (!view.combat) return null;
  const stand = p.g.position.find((b) => b.action_key === 'stand');
  return (
    <ScrollView style={{ ...scrollPaper, flex: 1 }} contentContainerStyle={{ padding: 24 }}>
      <Text accessibilityRole="header" style={titleStyle}>
        Combat
      </Text>
      <Text style={prose}>{text(view.combat.name)}</Text>
      {view.bleeding && <Text style={prose}>{text(view.bleeding.label)}</Text>}
      {view.combat.active_opponents?.map((opponent) => (
        <Text key={opponent.id} style={prose}>
          {text(opponent.name)}
          {opponent.id === view.combat!.opponent_id ? ' (your target)' : ''}
        </Text>
      ))}
      {combatLog.map((line, i) => (
        <Text key={i} style={prose}>
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
