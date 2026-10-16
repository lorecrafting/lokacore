// A full reading page with the offered actions following its combat history.
import { Text, View } from 'react-native';
import { bleedingLine, conditionLine, type group } from './model.ts';
import { ActionCard, Cards } from './actions.tsx';
import { LogLines } from './lines.tsx';
import { LABEL } from './labels.ts';
import { Control, Page, RunningHead } from './pages.tsx';
import { prose, usePalette } from './palette.ts';
import type { presenter, Button } from './presenter.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
type Encounter = NonNullable<Screen['ended']>;

// The fight's state: its name, your bleeding and the opponents, one block of touching lines
// (a run of one kind, like the mock's entity lines; BOOK-UI-COMPONENTS.md, Page).
function Fight({ view, text, combat }: Pick<Screen, 'view' | 'text'> & { combat: Encounter }) {
  const c = usePalette();
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
  world: () => void;
}) {
  const c = usePalette();
  const { view, text, combatLog, ended } = p.screen;
  const combat = view.combat ?? ended;
  if (!combat) return null;
  // A closed encounter keeps its page: no actions, one Back to World (book-ui.md, Closure).
  const foot = !view.combat && <Control label={LABEL.backToWorld} onPress={p.world} />;
  const stand = p.g.position.find((b) => b.action_key === 'stand');
  return (
    // Paper behind the running head too: the leaving page fades over the arriving one.
    <View style={{ backgroundColor: c.bg, flex: 1 }}>
      <RunningHead view={view} text={text} />
      <Page title="Combat" foot={foot}>
        <Fight view={view} text={text} combat={combat} />
        <LogLines lines={combatLog} />
        {view.combat && (
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
        )}
      </Page>
    </View>
  );
}
