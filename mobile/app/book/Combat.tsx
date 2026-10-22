// A full reading page with the offered actions following its combat history.
import { View } from 'react-native';
import { Text } from './Text.tsx';
import { bandPhrase, type group } from './model.ts';
import { ActionCard, Cards } from './actions.tsx';
import { LogLines } from './lines.tsx';
import { LABEL } from './labels.ts';
import { Control, Page, RunningHead } from './pages.tsx';
import { prose, usePalette, useType } from './palette.ts';
import type { presenter, Button } from './presenter.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
type Encounter = NonNullable<Screen['ended']>;

// The opponent lines, "name — band", one block of touching lines (a run of one kind, like the
// mock's entity lines; Page's doc comment). Your own bleeding and conditions stay on the
// status line and Character (book-ui.md, Live combat response).
function Fight({ view, text, combat }: Pick<Screen, 'view' | 'text'> & { combat: Encounter }) {
  const c = usePalette();
  const t = useType();
  const { opponent_id: id, name, band } = combat;
  return (
    <View>
      {(combat.active_opponents ?? [{ id, name, band }]).map((opponent) => (
        <Text key={opponent.id} style={prose(c, t)}>
          {text(opponent.name)}
          {combat.active_opponents && opponent.id === combat.opponent_id && view.combat
            ? ' (your target)'
            : ''}
          {/* a closed encounter's band is stale (a dead foe has none) */}
          {view.combat && opponent.band && ` — ${bandPhrase({ band: opponent.band }, text)}`}
        </Text>
      ))}
    </View>
  );
}

/**
 * The combat foreground (book-ui.md, Live combat response).
 *
 * Use: while a fight is on.
 *
 * Rules: opponent lines (name, band phrase; none of your own condition lines) as one block of touching lines, then the isolated log, then the response cards; no PageFoot.
 *
 * States: one foe; pack; bleeding.
 *
 * Story: CombatPage.stories.tsx
 */
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
