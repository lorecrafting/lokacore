import { cap, plain } from './model.ts';
import { Fragment } from 'react';
import { Text } from './Text.tsx';
import { SectionTitle } from './pages.tsx';
import { Note } from './lines.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import type { Thing } from './model.ts';
import { note, prose, usePalette, useType } from './palette.ts';
import { ActionCard, Cards } from './actions.tsx';
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
 * An item's projected stats on its detail page.
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
      {item?.liquid && (
        <Text style={note(c, t)}>
          {p.text(item.liquid.label)}: {item.liquid.quantity}/{item.liquid.capacity}{' '}
          {p.text(item.liquid.unit_label)}
        </Text>
      )}
      {item?.fuel && (
        <Text style={note(c, t)}>
          Fuel {item.fuel.remaining} of {item.fuel.capacity}
          {item.fuel.lit ? ', lit' : ', unlit'}
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
