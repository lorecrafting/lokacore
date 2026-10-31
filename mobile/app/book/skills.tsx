import { cap, plain, why } from './model.ts';
import { View } from 'react-native';
import { LABEL } from './labels.ts';
import { amountWords, liquidWords } from './pick.ts';
import { castWords, commandOf } from './buttons.ts';
import { Fragment } from 'react';
import { Text } from './Text.tsx';
import { SectionTitle } from './pages.tsx';
import { Note } from './lines.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import type { Thing } from './model.ts';
import { note, prose, usePalette, useType, type Palette, type Type } from './palette.ts';
import { ActionCard, Cards, PickLists } from './actions.tsx';
import type { Button } from './presenter.ts';
import { cardKey } from './presenter.ts';

// pass-1 H3 (book-ui.md Skill tree details): a qualified learned box has nothing left to meet.
const learned = (s: NonNullable<GameView['skills']>[number], text: (key: string) => string) =>
  s.qualified ? 'learned' : `learned, unqualified. ${text(s.requirement)}`;

/**
 * The Character page's topics, attributes and skills.
 * - Use: CharacterPage only.
 * - Story: SectionPages.stories.tsx
 */
export function SkillDetails(p: { view?: GameView; text: (key: string) => string }) {
  const c = usePalette();
  const t = useType();
  return (
    <>
      {p.view?.topics?.map((k) => (
        <Text key={k.topic.key} style={prose(c, t)}>
          {p.text(k.label)}
        </Text>
      ))}
      {p.view?.attributes?.map((a) => (
        <Text key={a.attribute.key} style={prose(c, t)}>
          {a.attribute.key.toUpperCase()} {a.value}
          {a.worn ? ` (${a.worn > 0 ? '+' : ''}${a.worn} worn)` : ''}
        </Text>
      ))}
      {p.view?.skills
        ?.filter((s) => s.acquired && !s.profession)
        .map((s) => (
          <Text key={s.skill.key} style={prose(c, t)}>
            {p.text(s.label)} — {learned(s, p.text)}
          </Text>
        ))}
    </>
  );
}

/**
 * Each profession in first-listed order, acquired boxes as body text, unacquired as a Note
 * (book-ui.md, Skill tree details).
 * - Use: CharacterPage only.
 * - Story: SectionPages.stories.tsx
 */
export function Professions(p: { view?: GameView; text: (key: string) => string }) {
  const c = usePalette();
  const t = useType();
  const listed = p.view?.skills?.filter((s) => s.profession) ?? [];
  return [...new Set(listed.map((s) => s.profession!))].map((profession) => (
    <Fragment key={profession}>
      <SectionTitle>{p.text(profession)}</SectionTitle>
      {listed
        .filter((s) => s.profession === profession)
        .map((s) =>
          s.acquired ? (
            <Text key={s.skill.key} style={prose(c, t)}>
              {p.text(s.label)}
              {s.level === undefined ? '' : `, level ${s.level}`} — {learned(s, p.text)}
            </Text>
          ) : (
            <Note key={s.skill.key}>
              {`${p.text(s.label)} — ${s.locked ? 'locked' : 'not learned'}. ${p.text(s.requirement)}`}
            </Note>
          ),
        )}
    </Fragment>
  ));
}

type Levelling = NonNullable<GameView['levelling']>;
const points = (n: number) => (n ? `, ${n} point${n === 1 ? '' : 's'} to spend` : '');
/** The Character page's level line (row 4), after the ancestry line. */
export const levelLine = (l: Levelling) => `Level ${l.level}${points(l.unspent)}`;
/** The resource block's last line, plain like pennies: no band tone, no next at the top level. */
export const xpLine = (l: Levelling) =>
  `xp  ${l.experience}${l.next === undefined ? '' : ` / ${l.next}`}`;

/**
 * The Raise cards, one per authored attribute, the Character page's last block (book-ui.md,
 * Levelling details).
 * - Use: while raise_attribute is offered.
 * - Rules: a pending save shows on the status line.
 * - Story: SectionPages.stories.tsx
 */
export function RaiseCards(p: { buttons?: Button[]; press?: (b: Button) => void }) {
  return (
    <Cards>
      {p.buttons
        ?.filter((b) => b.action_key === 'raise_attribute')
        .map((b) => (
          <ActionCard key={cardKey(b)} b={b} press={p.press!} />
        ))}
    </Cards>
  );
}

/**
 * An item's projected stats on its detail page. A vessel's liquid and a light's fuel read in words,
 * never a count (book-ui.md Line placement).
 * - Use: ThingPage only.
 * - Story: ItemPage.stories.tsx
 */
export function ItemDetails(p: { thing?: Thing; text: (key: string) => string }) {
  const c = usePalette();
  const t = useType();
  const item = p.thing;
  return (
    <>
      {item?.description && <Text style={prose(c, t)}>{plain(p.text(item.description))}</Text>}
      {item?.liquid && <Text style={note(c, t)}>{liquidWords(item.liquid, p.text)}</Text>}
      {item?.fuel && (
        <Text style={note(c, t)}>
          {amountWords(item.fuel.remaining, item.fuel.capacity, 'fuel')}
          {item.fuel.lit ? ', lit.' : ', unlit.'}
        </Text>
      )}
      {item?.state && <Text style={note(c, t)}>{cap(item.state)}</Text>}
      {item?.slot && (item.weapon || item.block_chance !== undefined) && (
        <Text style={note(c, t)}>Slot: {item.slot}</Text>
      )}
      {item?.weapon && (
        <Text style={note(c, t)}>
          Attack: {item.weapon.attack.chance}% chance, {item.weapon.attack.damage_min}
          {item.weapon.attack.damage_max !== item.weapon.attack.damage_min
            ? `–${item.weapon.attack.damage_max}`
            : ''}{' '}
          damage; requires {item.skill_label ? p.text(item.skill_label) : item.weapon.skill.key}.
          {item.skill_requirement ? ` ${p.text(item.skill_requirement)}` : ''}
        </Text>
      )}
      {item?.block_chance !== undefined && (
        <Text style={note(c, t)}>Block: {item.block_chance}% chance.</Text>
      )}
    </>
  );
}

// The spell words refused here, each with its reason (owner, mvl9qy5ut2x2), then each aimed spell's
// Cast on… list of its targets (loka-x6t.109.5): the target pages' Cast a spell… rows (buttons.ts).
export function spells(p: {
  view?: GameView;
  text: (key: string) => string;
  buttons?: Button[];
  press?: (b: Button) => void;
  pending?: boolean;
}) {
  const refused = p.view?.spell_words?.length ? castWords(p.view).filter((s) => !s.available) : [];
  const aimed = (p.buttons ?? []).filter((b) => b.pick && commandOf(b) === 'cast');
  if (!refused.length && !aimed.length) return null;
  return (
    <View>
      <SectionTitle>{LABEL.spells}</SectionTitle>
      {refused.map((s) => (
        <ActionCard key={s.word} label={`${s.word}, cast`} reason={why(s, p.text)} />
      ))}
      {p.view && p.press && aimed.length > 0 && (
        <PickLists
          page="character"
          view={p.view}
          buttons={aimed}
          text={p.text}
          press={p.press}
          pending={p.pending}
        />
      )}
    </View>
  );
}

// The skills this NPC teaches: learned or not, and whether the player qualifies now.
export const npcSkills = (
  c: Palette,
  t: Type,
  p: { view: GameView; npc?: Thing; text: (key: string) => string },
) =>
  p.view.skills
    ?.filter(
      (s) =>
        p.npc &&
        'lessons' in p.npc &&
        p.npc.lessons?.some(
          (r) =>
            r.cartridge_id === s.skill.cartridge_id &&
            r.cartridge_version === s.skill.cartridge_version &&
            r.kind === s.skill.kind &&
            r.key === s.skill.key,
        ),
    )
    .map((s) => {
      const locked = s.locked && !s.acquired; // learned reads first, as on the Character page
      return (
        <Text key={s.skill.key} style={note(c, t)}>
          {locked
            ? `You cannot learn ${p.text(s.label)} yet`
            : s.acquired
              ? `You know ${p.text(s.label)}${s.qualified ? '' : ' but cannot use it yet'}`
              : `${cap(p.text(p.npc!.name))} teaches ${p.text(s.label)}`}
          {/* a qualified skill asks nothing more (pass-1 H3); a locked one always names its need */}
          {s.qualified && !locked ? '.' : `. ${p.text(s.requirement)}`}
        </Text>
      );
    });
