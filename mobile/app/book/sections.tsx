// The Contents sections (Character, Ancestry, Carrying, Map, Settings; Journal: journal.tsx) and
// the chapter and scene pages. Each is only drawing; what a tap does is passed in by Book.tsx.
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import {
  bandPhrase,
  cap,
  conditionLine,
  plain,
  isPool,
  toneOf,
  type group,
  type Thing,
} from './model.ts';
import type { Button } from './presenter.ts';
import { note, prose, usePalette, useType } from './palette.ts';
import { DiscoveredMap } from './DiscoveredMap.tsx';
import { ReadingSize } from './Chip.tsx';
import type { Reading } from './reading.ts';
import { levelLine, Professions, RaiseCards, SkillDetails, spells, xpLine } from './skills.tsx';
import { size, space } from './tokens.ts';
import { ActionCard, Cards, ContinueButton } from './actions.tsx';
import { EntityLine, Note } from './lines.tsx';
import { band, Control, home, type Home, Page, SectionTitle, useTitleFocus } from './pages.tsx';
import { LABEL } from './labels.ts';

type Say = (key: string) => string;
type Carrying = Home & {
  items: readonly Thing[];
  equipment?: GameView['equipment'];
  text: Say;
  open: (id: string) => void;
};
type Grouped = ReturnType<typeof group>;

// A profession box is drawn even unacquired (book-ui.md Skill tree details), so it counts as known.
const knownSkill = (s: { acquired: boolean; profession?: string }) => s.acquired || !!s.profession;

type Character = { view?: GameView; text: Say; pending?: boolean } & Home &
  Pick<GameView, 'resources' | 'position'> &
  Parameters<typeof RaiseCards>[0];

/**
 * The Character section: attributes, skills, professions, the Raise cards, then Spells: each
 * spell word castable here as an ActionCard `<word>, cast` (an accepted cast turns to World with its
 * line), each refused here in its unavailable form (book-ui.md, Unavailable actions), and each aimed
 * spell's Cast on… list (book-ui.md, Skill tree details; Word bar); no Spells when none is.
 * - Use: Contents, and the status pools when only pennies show.
 * - Story: SectionPages.stories.tsx
 */
export function CharacterPage(p: Character) {
  const c = usePalette();
  const t = useType();
  // Real data only: the body's resources when GameView carries them; the phrase on hp only.
  const resources = p.resources ?? p.view?.resources ?? [];
  const position = p.position ?? p.view?.position;
  const levelling = p.view?.levelling;
  const name = p.view?.actor_name;
  const known = resources.length || p.view?.attributes?.length || p.view?.skills?.some(knownSkill);
  return (
    <Page title={LABEL.character} foot={home(p)}>
      {!known && !name && <Note>{LABEL.nothingKnown}</Note>}
      {name && <Text style={prose(c, t)}>{p.text(name)}</Text>}
      {position && <Text style={prose(c, t)}>{cap(position)}</Text>}
      {p.view?.ancestry && (
        <Text style={prose(c, t)}>{cap(p.view.ancestry.replaceAll('_', '-'))}</Text>
      )}
      {levelling && <Text style={prose(c, t)}>{levelLine(levelling)}</Text>}
      {p.view?.bleeding && <Text style={prose(c, t)}>{p.text(p.view.bleeding.label)}</Text>}
      {p.view?.conditions?.map((x, i) => (
        <Text key={`${x.label}-${i}`} style={prose(c, t)}>
          {cap(conditionLine(x, p.view!.time, p.text))}
        </Text>
      ))}
      <SkillDetails view={p.view} text={p.text} />
      {resources.map((r) => (
        <Text key={r.resource.key} style={{ ...prose(c, t), color: band(c, toneOf(r)) }}>
          {`${r.resource.key}  ${isPool(r) ? `${r.current} / ${r.maximum}` : r.current}${r.resource.key === 'hp' ? `, ${bandPhrase(r, p.text)}` : ''}`}
        </Text>
      ))}
      {levelling && <Text style={prose(c, t)}>{xpLine(levelling)}</Text>}
      <Professions view={p.view} text={p.text} />
      <RaiseCards {...p} />
      {spells(p)}
    </Page>
  );
}

/**
 * The ancestry picker.
 * - Use: Contents, before an ancestry is chosen.
 * - Rules: its pending save is a Note, not the status line's.
 * - Story: SectionPages.stories.tsx
 */
export function AncestryPage(p: {
  view: GameView;
  text: Say;
  buttons: Button[];
  pending: boolean;
  press: (b: Button) => void;
}) {
  const c = usePalette();
  const t = useType();
  return (
    <Page title={LABEL.chooseAncestry}>
      <Text style={prose(c, t)}>{LABEL.chooseOnce}</Text>
      {p.view.ancestry_choices?.map((choice) => {
        const button = p.buttons.find(
          (b) =>
            b.action_key === 'choose_ancestry' &&
            (b.input as { ancestry?: string }).ancestry === choice.key,
        );
        return (
          <View key={choice.key} style={{ gap: space.sm }}>
            <Text style={prose(c, t)}>{p.text(choice.description)}</Text>
            {button && <ActionCard b={button} press={p.press} />}
          </View>
        );
      })}
      {p.pending && <Note>{LABEL.saveNotConfirmed}</Note>}
    </Page>
  );
}

/**
 * The Carrying section: Held and Worn items as Entity lines.
 * - Use: Contents.
 * - Rules: an empty Worn slot is a Note; a Worn item's target is its shown line (the next slot covers its bleed).
 * - Story: SectionPages.stories.tsx
 */
export function CarryingPage(p: Carrying) {
  const c = usePalette();
  const t = useType();
  return (
    <Page title={LABEL.inventory} foot={home(p)}>
      <SectionTitle>{LABEL.held}</SectionTitle>
      {p.items.length === 0 && <Note>{LABEL.carryingNothing}</Note>}
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
                <Text style={note(c, t)}>{cap(slot.replaceAll('_', ' '))}</Text>
                {item ? (
                  <EntityLine name={p.text(item.name)} onPress={() => p.open(item.id)} />
                ) : (
                  <Note>{LABEL.empty}</Note>
                )}
              </View>
            ))}
          </View>
        </>
      )}
    </Page>
  );
}

/**
 * The full map and Where (book-ui.md, Minimap, map and presentation controls).
 * - Use: Contents, and a tap on the minimap.
 * - Rules: the drawing and the current place only; no movement, door or place actions (owner
 *   2026-10-30). Where lists each known NPC's offered Where action.
 * - States: discovered, one level; two levels; unexplored exits; a dot tapped; Where.
 * - Story: MapPage.stories.tsx
 */
export function MapPage(
  p: {
    view: GameView;
    text: Say;
    g: Grouped;
    press: (b: Button) => void;
  } & Home,
) {
  const c = usePalette();
  const t = useType();
  return (
    <Page title={LABEL.map} foot={home(p)}>
      {p.view.map && <DiscoveredMap view={p.view} text={p.text} />}
      <Text style={prose(c, t)}>{LABEL.currentPlace(p.text(p.view.place.title.key))}</Text>
      {p.view.exits.length === 0 && <Note>{LABEL.noWayOut}</Note>}
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

/**
 * Settings: the Reading size first, then Start over.
 * - Use: Contents.
 * - Rules: `startOver` asks first: it destroys the save (10 §31; the shell's confirm).
 * - Story: SectionPages.stories.tsx
 */
export function SettingsPage(p: { startOver: () => void; reading?: Reading } & Home) {
  return (
    <Page title={LABEL.settings} foot={home(p)}>
      {p.reading && <ReadingSize {...p.reading} />}
      <Control label={LABEL.startOver} onPress={p.startOver} />
    </Page>
  );
}

/**
 * The chapter title page: label, title and rule centred, then Continue.
 * - Use: a chapter's title page.
 * - Rules: label and title are one header node named by its visible text in order ("Chapter one
 *   <title>"), with the arriving focus. Nothing but Continue is pressable. The mock's `.chapter`
 *   without its fleuron, subtitle and auto-dismiss.
 * - Story: ChapterPages.stories.tsx
 */
export function ChapterPage(p: { label: string; title: string; done: () => void }) {
  const c = usePalette();
  const t = useType();
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
          <Text style={[t.chapterLabel, { color: c.dim, textAlign: 'center' }]}>{p.label}</Text>
          <Text style={[t.chapterTitle, { color: c.fg, textAlign: 'center' }]}>{p.title}</Text>
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
        <ContinueButton label={LABEL.continue} onPress={p.done} />
      </View>
    </Page>
  );
}

/**
 * A modal scene: its text, then Continue (book-ui.md, Chapters, scenes and recovery).
 * - Use: while a scene holds the foreground.
 * - Story: ChapterPages.stories.tsx
 */
export function ScenePage(p: {
  scene: NonNullable<GameView['scene']>;
  text: Say;
  next?: Button;
  press: (b: Button) => void;
}) {
  const c = usePalette();
  const t = useType();
  return (
    <Page>
      <Text {...useTitleFocus()} style={prose(c, t)}>
        {plain(p.text(p.scene.line))}
      </Text>
      {p.next && <ContinueButton label={p.next.label} onPress={() => p.press(p.next!)} />}
    </Page>
  );
}
