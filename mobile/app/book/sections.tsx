// The Contents sections (Character, Ancestry, Journal, Carrying, Map, Settings) and the chapter
// and scene pages. Each is only drawing; what a tap does is passed in by Book.tsx.
import { Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import {
  bandPhrase,
  cap,
  expeditionLine,
  plain,
  toneOf,
  why,
  type group,
  type Thing,
} from './model.ts';
import type { Button } from './presenter.ts';
import { note, prose, usePalette } from './palette.ts';
import { DiscoveredMap } from './DiscoveredMap.tsx';
import { SkillDetails } from './skills.tsx';
import { Act, band, sectionTitleStyle, Sheet, Tap } from './pages.tsx';

type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;

export function CharacterPage(
  p: { view?: GameView; text: Say } & Pick<GameView, 'resources' | 'position'>,
) {
  const c = usePalette();
  // Real data only: the body's resources when GameView carries them; the phrase on hp only.
  const resources = p.resources ?? p.view?.resources ?? [];
  const position = p.position ?? p.view?.position;
  const known =
    resources.length || p.view?.attributes?.length || p.view?.skills?.some((s) => s.acquired);
  return (
    <Sheet title="Character">
      {!known && <Text style={note(c)}>Nothing is known about you yet.</Text>}
      {position && <Text style={prose(c)}>{cap(position)}</Text>}
      {p.view?.ancestry && (
        <Text style={prose(c)}>{cap(p.view.ancestry.replaceAll('_', '-'))}</Text>
      )}
      {p.view?.bleeding && <Text style={prose(c)}>{p.text(p.view.bleeding.label)}</Text>}
      <SkillDetails view={p.view} text={p.text} />
      {resources.map((r) => (
        <Text key={r.resource.key} style={{ ...prose(c), color: band(c, toneOf(r)) }}>
          {`${r.resource.key}  ${r.current} / ${r.maximum}${r.resource.key === 'hp' ? `, ${bandPhrase(r, p.text)}` : ''}`}
        </Text>
      ))}
    </Sheet>
  );
}

export function AncestryPage(p: {
  view: GameView;
  text: Say;
  buttons: Button[];
  pending: boolean;
  press: (b: Button) => void;
}) {
  const c = usePalette();
  return (
    <Sheet title="Choose your ancestry">
      <Text style={prose(c)}>Choose once before your story begins.</Text>
      {p.view.ancestry_choices?.map((choice) => {
        const button = p.buttons.find(
          (b) =>
            b.action_key === 'choose_ancestry' &&
            (b.input as { ancestry?: string }).ancestry === choice.key,
        );
        return (
          <View key={choice.key}>
            <Text style={prose(c)}>{p.text(choice.description)}</Text>
            {button && <Act b={button} press={p.press} />}
          </View>
        );
      })}
      {p.pending && <Text style={note(c)}>save not confirmed</Text>}
    </Sheet>
  );
}

export function JournalPage({ view, text }: { view: GameView; text: Say }) {
  const c = usePalette();
  return (
    <Sheet title="Journal">
      {view.journal.length === 0 && <Text style={note(c)}>Nothing written yet.</Text>}
      {view.journal.map((q) => (
        <View key={`${q.quest.cartridge_id}@${q.quest.cartridge_version}:${q.quest.key}`}>
          <Text style={prose(c)}>{text(q.title)}</Text>
          <Text style={note(c)}>{String(q.state).replaceAll('_', ' ')}</Text>
          {q.patrol && (
            <Text style={prose(c)}>
              {q.patrol.credit} of {q.patrol.required} checkpoints. {q.patrol.status}.{' '}
              {text(q.patrol.leader_name)} is at {text(q.patrol.room_title)}.{' '}
              {q.patrol.status === 'awaiting'
                ? `Walk ${q.patrol.direction} to join him.`
                : q.patrol.status === 'paused'
                  ? `Return to ${text(q.patrol.leader_name)} and choose Rejoin.`
                  : q.patrol.status === 'failed'
                    ? `Return to ${text(q.patrol.leader_name)} and choose Restart now.`
                    : q.patrol.status === 'together'
                      ? `Next: ${text(q.patrol.next_title)}.`
                      : ''}
            </Text>
          )}
          {q.expedition && (
            <Text style={note(c)}>
              {q.expedition.cursor} of {q.expedition.required} entries.{' '}
              {expeditionLine(q.expedition, text)} {q.expedition.sheltered ? 'Shelter used.' : ''}
            </Text>
          )}
          {q.journal && <Text style={prose(c)}>{plain(text(q.journal))}</Text>}
        </View>
      ))}
    </Sheet>
  );
}

export function CarryingPage(p: {
  items: readonly Thing[];
  equipment?: GameView['equipment'];
  text: Say;
  open: (id: string) => void;
}) {
  const c = usePalette();
  return (
    <Sheet title="Equipment & Inventory">
      <Text style={sectionTitleStyle(c)}>Held</Text>
      {p.items.length === 0 && <Text style={note(c)}>You are carrying nothing.</Text>}
      {p.items.map((e) => (
        <Tap key={e.id} label={`${p.text(e.name)}, open`} onPress={() => p.open(e.id)}>
          <Text style={prose(c)}>{p.text(e.name)}</Text>
        </Tap>
      ))}
      {(p.equipment?.length ?? 0) > 0 && <Text style={sectionTitleStyle(c)}>Worn</Text>}
      {p.equipment?.map(({ slot, item }) => (
        <View key={slot}>
          <Text style={note(c)}>{cap(slot.replaceAll('_', ' '))}</Text>
          {item ? (
            <Tap label={`${p.text(item.name)}, open`} onPress={() => p.open(item.id)}>
              <Text style={{ ...prose(c), color: c.action }}>{p.text(item.name)}</Text>
            </Tap>
          ) : (
            <Text style={note(c)}>Empty</Text>
          )}
        </View>
      ))}
    </Sheet>
  );
}

// Each exit's own controls, kept separate from movement; sight is read-only cartridge prose.
function Ways(p: { view: GameView; text: Say; g: Grouped; press: (b: Button) => void }) {
  const c = usePalette();
  return p.view.exits.map((e) => {
    const move = p.g.exits.find((x) => x.direction === e.direction)?.button;
    return (
      <View key={e.direction} style={{ marginTop: 12 }}>
        {move ? (
          <Act b={move} press={p.press} />
        ) : (
          <Text style={note(c)}>
            {cap(e.direction)}
            {!e.available && `: ${why(e, p.text)}`}
          </Text>
        )}
        {e.door && (
          <Text style={prose(c)}>
            {cap(p.text(e.door.name))}: {e.door.state}
          </Text>
        )}
        {p.g.door(e.direction).map((b) => (
          <Act key={b.action_key} b={b} press={p.press} />
        ))}
        {e.sight && (
          <Text style={note(c)}>
            {`Beyond ${e.direction}: ${p.text(e.sight.title)}${
              e.sight.entities.length
                ? ` — ${e.sight.entities.map((x) => p.text(x.name)).join(', ')}`
                : ''
            }.`}
          </Text>
        )}
      </View>
    );
  });
}

// Map reuses the room's exit controls and lists the place's targetless actions.
export function MapPage(p: {
  view: GameView;
  text: Say;
  g: Grouped;
  press: (b: Button) => void;
  log?: readonly string[];
}) {
  const c = usePalette();
  return (
    <Sheet title="Map">
      {p.log?.map((line, i) => (
        <Text key={i} style={prose(c)}>
          {line}
        </Text>
      ))}
      {p.view.map && <DiscoveredMap view={p.view} text={p.text} />}
      <Text style={prose(c)}>Current place: {p.text(p.view.place.title.key)}</Text>
      {p.view.exits.length === 0 && <Text style={note(c)}>No way out is known.</Text>}
      <Ways
        {...p}
        view={p.view.map ? { ...p.view, exits: p.view.exits.map(({ sight, ...e }) => e) } : p.view}
      />
      {p.g.place.map((b) => (
        <Act key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
      ))}
      {p.view.known_npcs?.length ? <Text style={sectionTitleStyle(c)}>Where</Text> : null}
      {(p.view.known_npcs ?? []).map((n) =>
        p.g
          .on(n.id)
          .filter((b) => b.action_key === 'where')
          .map((b) => <Act key={n.id} b={b} press={p.press} />),
      )}
    </Sheet>
  );
}

// `startOver` asks first: it destroys the save (the shell's confirm). Nothing else lives here yet.
export function SettingsPage({ startOver }: { startOver: () => void }) {
  const c = usePalette();
  return (
    <Sheet title="Settings">
      <Tap label="Start over" onPress={startOver}>
        <Text style={{ ...prose(c), color: c.action }}>Start over</Text>
      </Tap>
    </Sheet>
  );
}

export function ChapterPage(p: { title: string; done: () => void }) {
  const c = usePalette();
  return (
    <Sheet title={p.title}>
      <Tap label="Continue" onPress={p.done}>
        <Text style={{ ...prose(c), color: c.action }}>Continue</Text>
      </Tap>
    </Sheet>
  );
}

export function ScenePage(p: {
  scene: NonNullable<GameView['scene']>;
  text: Say;
  next?: Button;
  press: (b: Button) => void;
}) {
  const c = usePalette();
  return (
    <Sheet title="">
      <Text style={prose(c)}>{plain(p.text(p.scene.line))}</Text>
      {p.next && <Act b={p.next} press={p.press} />}
    </Sheet>
  );
}
