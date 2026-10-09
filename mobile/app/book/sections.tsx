// The Contents sections (Character, Ancestry, Journal, Carrying, Map, Settings) and the chapter
// and scene pages. Each is only drawing; what a tap does is passed in by Book.tsx.
import { useState } from 'react';
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
import type { Button, DetailLine } from './presenter.ts';
import { note, prose, usePalette } from './palette.ts';
import { DiscoveredMap } from './DiscoveredMap.tsx';
import { SkillDetails } from './skills.tsx';
import { space } from './tokens.ts';
import { ActionCard, Cards, ContinueButton } from './actions.tsx';
import { EntityLine, LogLines } from './lines.tsx';
import { band, Control, Page, SectionTitle, titleFocus } from './pages.tsx';

const home = (world: () => void) => <Control label="Back to World" onPress={world} />;

type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;

export function CharacterPage(
  p: { view?: GameView; text: Say; world: () => void } & Pick<GameView, 'resources' | 'position'>,
) {
  const c = usePalette();
  // Real data only: the body's resources when GameView carries them; the phrase on hp only.
  const resources = p.resources ?? p.view?.resources ?? [];
  const position = p.position ?? p.view?.position;
  const known =
    resources.length || p.view?.attributes?.length || p.view?.skills?.some((s) => s.acquired);
  return (
    <Page title="Character" foot={home(p.world)}>
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
    </Page>
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
    <Page title="Choose your ancestry">
      <Text style={prose(c)}>Choose once before your story begins.</Text>
      {p.view.ancestry_choices?.map((choice) => {
        const button = p.buttons.find(
          (b) =>
            b.action_key === 'choose_ancestry' &&
            (b.input as { ancestry?: string }).ancestry === choice.key,
        );
        return (
          <View key={choice.key} style={{ gap: space.sm }}>
            <Text style={prose(c)}>{p.text(choice.description)}</Text>
            {button && <ActionCard b={button} press={p.press} />}
          </View>
        );
      })}
      {p.pending && <Text style={note(c)}>save not confirmed</Text>}
    </Page>
  );
}

export function JournalPage({
  view,
  text,
  world,
}: {
  view: GameView;
  text: Say;
  world: () => void;
}) {
  const c = usePalette();
  return (
    <Page title="Journal" foot={home(world)}>
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
    </Page>
  );
}

export function CarryingPage(p: {
  items: readonly Thing[];
  equipment?: GameView['equipment'];
  text: Say;
  open: (id: string) => void;
  world: () => void;
}) {
  const c = usePalette();
  return (
    <Page title="Equipment & Inventory" foot={home(p.world)}>
      <SectionTitle>Held</SectionTitle>
      {p.items.length === 0 && <Text style={note(c)}>You are carrying nothing.</Text>}
      {p.items.map((e) => (
        <EntityLine key={e.id} name={p.text(e.name)} onPress={() => p.open(e.id)} />
      ))}
      {(p.equipment?.length ?? 0) > 0 && <SectionTitle>Worn</SectionTitle>}
      {p.equipment?.map(({ slot, item }) => (
        <View key={slot}>
          <Text style={note(c)}>{cap(slot.replaceAll('_', ' '))}</Text>
          {item ? (
            <EntityLine name={p.text(item.name)} onPress={() => p.open(item.id)} />
          ) : (
            <Text style={note(c)}>Empty</Text>
          )}
        </View>
      ))}
    </Page>
  );
}

// Each exit's own controls, kept separate from movement; sight is read-only cartridge prose.
function Ways(p: { view: GameView; text: Say; g: Grouped; press: (b: Button) => void }) {
  const c = usePalette();
  return p.view.exits.map((e) => {
    const move = p.g.exits.find((x) => x.direction === e.direction)?.button;
    return (
      <View key={e.direction} style={{ gap: space.sm }}>
        {move ? (
          <ActionCard b={move} press={p.press} />
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
          <ActionCard key={b.action_key} b={b} press={p.press} />
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
  log?: readonly DetailLine[];
  world: () => void;
}) {
  const c = usePalette();
  const [selected, select] = useState<string | null>(null);
  const chosen = p.view.map?.rooms.some((r) => r.id === selected);
  return (
    <Page
      title="Map"
      foot={
        <>
          {chosen && <Control label="Back to map" onPress={() => select(null)} />}
          <Control label="Back to World" onPress={p.world} />
        </>
      }
    >
      {p.log && <LogLines lines={p.log} />}
      {p.view.map && (
        <DiscoveredMap view={p.view} text={p.text} selected={selected} select={select} />
      )}
      <Text style={prose(c)}>Current place: {p.text(p.view.place.title.key)}</Text>
      {p.view.exits.length === 0 && <Text style={note(c)}>No way out is known.</Text>}
      <Ways
        {...p}
        view={p.view.map ? { ...p.view, exits: p.view.exits.map(({ sight, ...e }) => e) } : p.view}
      />
      <Cards>
        {p.g.place.map((b) => (
          <ActionCard key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
        ))}
      </Cards>
      {p.view.known_npcs?.length ? <SectionTitle>Where</SectionTitle> : null}
      <Cards>
        {(p.view.known_npcs ?? []).map((n) =>
          p.g
            .on(n.id)
            .filter((b) => b.action_key === 'where')
            .map((b) => <ActionCard key={n.id} b={b} press={p.press} />),
        )}
      </Cards>
    </Page>
  );
}

// `startOver` asks first: it destroys the save (the shell's confirm). Nothing else lives here yet.
export function SettingsPage(p: { startOver: () => void; world: () => void }) {
  return (
    <Page title="Settings" foot={home(p.world)}>
      <Control label="Start over" onPress={p.startOver} />
    </Page>
  );
}

export function ChapterPage(p: { title: string; done: () => void }) {
  return (
    <Page title={p.title}>
      <ContinueButton label="Continue" onPress={p.done} />
    </Page>
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
    <Page>
      <Text {...titleFocus} style={prose(c)}>
        {plain(p.text(p.scene.line))}
      </Text>
      {p.next && <ContinueButton label={p.next.label} onPress={() => p.press(p.next!)} />}
    </Page>
  );
}
