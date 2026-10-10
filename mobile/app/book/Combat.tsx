// A full reading page with the offered actions following its combat history.
import { Text, View } from 'react-native';
import { bleedingLine, conditionLine, type group } from './model.ts';
import { ActionCard, Cards } from './actions.tsx';
import { LogLines } from './lines.tsx';
import { Page, RunningHead } from './pages.tsx';
import { prose, usePalette } from './palette.ts';
import type { presenter, Button } from './presenter.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

// The fight's state: its name, your bleeding and the opponents, one block of touching lines
// (a run of one kind, like the mock's entity lines; BOOK-UI-COMPONENTS.md, Page).
function Fight({ view, text }: Pick<Screen, 'view' | 'text'>) {
  const c = usePalette();
  const combat = view.combat!;
  return (
    <View>
      <Text style={prose(c)}>{text(combat.name)}</Text>
      {view.bleeding && (
        <Text style={prose(c)}>{bleedingLine(view.bleeding, view.time, text)}</Text>
      )}
      {view.conditions?.map((x, i) => {
        const line = conditionLine(x, view.time, text);
        return (
          <Text
            key={`${x.label}-${i}`}
            style={prose(c)}
            accessibilityLabel={line.replaceAll(' · ', ', ')}
          >
            {line}
          </Text>
        );
      })}
      {combat.active_opponents?.map((opponent) => (
        <Text key={opponent.id} style={prose(c)}>
          {text(opponent.name)}
          {opponent.id === combat.opponent_id ? ' (your target)' : ''}
        </Text>
      ))}
    </View>
  );
}

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
    // Paper behind the running head too: the leaving page fades over the arriving one.
    <View style={{ backgroundColor: c.bg, flex: 1 }}>
      <RunningHead view={view} text={text} />
      <Page title="Combat">
        <Fight view={view} text={text} />
        <LogLines lines={combatLog} />
        <Cards>
          {stand && <ActionCard b={stand} press={p.press} />}
          {p.g.look && <ActionCard b={p.g.look} press={p.press} />}
          {p.g.flee.map((b) => (
            <ActionCard key={b.label} b={b} press={p.press} />
          ))}
          {p.g.bandage.map((b) => (
            <ActionCard key={b.target_ids[0]} b={b} press={p.press} />
          ))}
        </Cards>
      </Page>
    </View>
  );
}
