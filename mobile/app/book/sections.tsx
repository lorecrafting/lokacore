// The Contents sections (Character, Ancestry, Journal, Carrying, Map, Settings) and the chapter
// and scene pages. Each is only drawing; what a tap does is passed in by Book.tsx.
// size: allow 326, conditions and the chapter card join its chapter and scene pages here (design-input-batch-6 §1: no new file); row 4 level, xp and Raise lines; the LABEL import (loka-x6t.11)
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
import { levelLine, RaiseCards, SkillDetails, xpLine } from './skills.tsx';
import { size, space, type } from './tokens.ts';
import { ActionCard, Cards, ContinueButton } from './actions.tsx';
import { EntityLine, LogLines, Note } from './lines.tsx';
import { band, Control, Page, SectionTitle, useTitleFocus } from './pages.tsx';
import { LABEL } from './labels.ts';

const home = (world: () => void) => <Control label={LABEL.backToWorld} onPress={world} />;

type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;

export function CharacterPage(
  p: { view?: GameView; text: Say; world: () => void } & Pick<GameView, 'resources' | 'position'> &
    Parameters<typeof RaiseCards>[0],
) {
  const c = usePalette();
  // Real data only: the body's resources when GameView carries them; the phrase on hp only.
  const resources = p.resources ?? p.view?.resources ?? [];
  const position = p.position ?? p.view?.position;
  const levelling = p.view?.levelling;
  const known =
    resources.length || p.view?.attributes?.length || p.view?.skills?.some((s) => s.acquired);
  return (
    <Page title="Character" foot={home(p.world)}>
      {!known && <Note>Nothing is known about you yet.</Note>}
      {position && <Text style={prose(c)}>{cap(position)}</Text>}
      {p.view?.ancestry && (
        <Text style={prose(c)}>{cap(p.view.ancestry.replaceAll('_', '-'))}</Text>
      )}
      {levelling && <Text style={prose(c)}>{levelLine(levelling)}</Text>}
      {p.view?.bleeding && <Text style={prose(c)}>{p.text(p.view.bleeding.label)}</Text>}
      {p.view?.conditions?.map((x, i) => (
        <Text key={`${x.label}-${i}`} style={prose(c)}>
          {cap(p.text(x.label))}
        </Text>
      ))}
      <SkillDetails view={p.view} text={p.text} />
      {resources.map((r) => (
        <Text key={r.resource.key} style={{ ...prose(c), color: band(c, toneOf(r)) }}>
          {`${r.resource.key}  ${r.current} / ${r.maximum}${r.resource.key === 'hp' ? `, ${bandPhrase(r, p.text)}` : ''}`}
        </Text>
      ))}
      {levelling && <Text style={prose(c)}>{xpLine(levelling)}</Text>}
      <RaiseCards {...p} />
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
      {p.pending && <Note>save not confirmed</Note>}
    </Page>
  );
}

export function JournalPage(p: { view: GameView; text: Say; world: () => void }) {
  const { view, text } = p;
  const c = usePalette();
  return (
    <Page title="Journal" foot={home(p.world)}>
      {view.journal.length === 0 && <Note>Nothing written yet.</Note>}
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
      <SectionTitle>{LABEL.held}</SectionTitle>
      {p.items.length === 0 && <Note>You are carrying nothing.</Note>}
      {p.items.length > 0 && (
        <View>
          {p.items.map((e) => (
            <EntityLine key={e.id} name={p.text(e.name)} onPress={() => p.open(e.id)} />
          ))}
        </View>
      )}
      {(p.equipment?.length ?? 0) > 0 && (
        <>
          <SectionTitle>{LABEL.worn}</SectionTitle>
          <View>
            {p.equipment!.map(({ slot, item }, i) => (
              <View key={`${slot}-${i}`}>
                <Text style={note(c)}>{cap(slot.replaceAll('_', ' '))}</Text>
                {item ? (
                  <EntityLine name={p.text(item.name)} onPress={() => p.open(item.id)} />
                ) : (
                  <Text style={note(c)}>Empty</Text>
                )}
              </View>
            ))}
          </View>
        </>
      )}
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
          <ActionCard label={cap(e.direction)} reason={e.available ? undefined : why(e, p.text)} />
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
          {chosen && <Control label={LABEL.backToMap} onPress={() => select(null)} />}
          <Control label={LABEL.backToWorld} onPress={p.world} />
        </>
      }
    >
      {p.log && <LogLines lines={p.log} />}
      {p.view.map && (
        <DiscoveredMap view={p.view} text={p.text} selected={selected} select={select} />
      )}
      <Text style={prose(c)}>Current place: {p.text(p.view.place.title.key)}</Text>
      {p.view.exits.length === 0 && <Note>No way out is known.</Note>}
      <Ways
        {...p}
        view={p.view.map ? { ...p.view, exits: p.view.exits.map(({ sight, ...e }) => e) } : p.view}
      />
      <Cards>
        {p.g.place.map((b) => (
          <ActionCard key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
        ))}
      </Cards>
      {where(p)}
    </Page>
  );
}

// Where each known NPC is: its offered Where action.
const where = (p: { view: GameView; g: Grouped; press: (b: Button) => void }) => (
  <>
    {p.view.known_npcs?.length ? <SectionTitle>{LABEL.where}</SectionTitle> : null}
    <Cards>
      {(p.view.known_npcs ?? []).map((n) =>
        p.g
          .on(n.id)
          .filter((b) => b.action_key === 'where')
          .map((b) => <ActionCard key={n.id} b={b} press={p.press} />),
      )}
    </Cards>
  </>
);

// `startOver` asks first: it destroys the save (the shell's confirm). Nothing else lives here yet.
export function SettingsPage(p: { startOver: () => void; world: () => void }) {
  return (
    <Page title="Settings" foot={home(p.world)}>
      <Control label={LABEL.startOver} onPress={p.startOver} />
    </Page>
  );
}

// The chapter card (BOOK-UI-COMPONENTS.md, Chapter card): label, title (the page header), rule.
export function ChapterPage(p: { label: string; title: string; done: () => void }) {
  const c = usePalette();
  return (
    <Page centred>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        {/* one header, named label then title, so the arriving focus reads "Chapter one" too */}
        <View
          accessible
          accessibilityRole="header"
          {...useTitleFocus()}
          style={{ alignItems: 'center', gap: space.sm }}
        >
          <Text style={[type.chapterLabel, { color: c.dim, textAlign: 'center' }]}>{p.label}</Text>
          <Text style={[type.chapterTitle, { color: c.fg, textAlign: 'center' }]}>{p.title}</Text>
        </View>
        <View
          style={{
            width: size.chapterRule,
            height: size.rule,
            backgroundColor: c.dim,
            marginTop: space.sm,
          }}
        />
      </View>
      <View style={{ alignItems: 'center' }}>
        <ContinueButton label="Continue" onPress={p.done} />
      </View>
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
      <Text {...useTitleFocus()} style={prose(c)}>
        {plain(p.text(p.scene.line))}
      </Text>
      {p.next && <ContinueButton label={p.next.label} onPress={() => p.press(p.next!)} />}
    </Page>
  );
}
