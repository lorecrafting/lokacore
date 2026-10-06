import { patrolChoice } from './cartridge_patrol.ts';
import { lesson, sequence } from './cartridge_skills.ts';
// The loader's dialogue checks (dialogue@1; dialogue.schema.json DialogueDefinition; 06 §8
// references exist, §17, §33), twin of lib/loka/content/dialogues.ex: what each dialogue uses, for
// the lock stage (content/cartridge.ts): its own kind and each fact.assign's fact_changed (and each story
// point its story_point_reached); and its references: its key is no registered command's, action's,
// recipe's or quest's (DUPLICATE_DEFINITION: its talk is an ActionSet identity), its prompt, labels
// and narrations have catalog entries, its speaker, roles and quest name an NPC, item or quest of
// this cartridge, its speaker is one of its npc roles, no role is named actor (the actor is always
// a participant: DUPLICATE_DEFINITION), it has a choice (the subset has no minProperties:
// SCHEMA_VIOLATION too_few_items), each accept names a quest of this cartridge in a dialogue
// without a quest, on a choice without a hand_over (else OUTCOME_MISMATCH: accepting would resolve,
// or activation and acquisition conflict), each hand_over gives an item role to an npc role, and
// each fact.assign names a fact of it with a value of its type. A speaker may have several
// dialogues: its talk opens the first, in key order, whose policy holds (mechanics/dialogue/shared.ts). Its policy
// is walked with every other policy (content/cartridge_refs.ts nodes). Each story point
// (cartridge.schema.json StoryPointDefinition; 23 §3) has an outcome (SCHEMA_VIOLATION
// too_few_items), and each outcome's trigger names a dialogue of this cartridge and one of its
// choices, a site no other outcome names (DUPLICATE_DEFINITION), in a dialogue that resolves a
// quest, so its choice is made once (OUTCOME_MISMATCH). Chapter markers resolve their texts,
// story points and selected outcomes, with an unconditional opening and unambiguous counted
// quest/choice triggers (mechanics.md Chapters).
import {
  CAPABILITY_OWNERS,
  type DefinitionRef,
  type Diagnostic,
  type FactValue,
} from '../contracts.gen.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { same } from '../foundation/compose.ts';
import { refString } from '../runtime/decision.ts';

const each = (c: Obj): [Obj, string][] =>
  Object.entries((c.dialogues ?? {}) as Obj).map(([ref, d]) => [
    d,
    `.cartridge.dialogues${step(ref)}`,
  ]);

/** Each owner reference of each dialogue and story point: [registry field, name, path]. */
export const uses = (c: Obj) =>
  [
    ...each(c).flatMap(([d, at]) => [
      ['definition', 'dialogue', at],
      ...Object.entries(d.choices as Obj).flatMap(([id, o]) => [
        ...(o.escort ? [['definition', 'escort', `${at}.choices${step(id)}.escort`]] : []),
        ...(o.receive ? [['event', 'item_acquired', `${at}.choices${step(id)}.receive`]] : []),
        ...(o.sequence ?? []).map((_: Obj, i: number) => [
          'event',
          'fact_changed',
          `${at}.choices${step(id)}.sequence[${i}].op`,
        ]),
      ]),
    ]),
    ...Object.keys((c.story_points ?? {}) as Obj).map((ref) => [
      'event',
      'story_point_reached',
      `.cartridge.story_points${step(ref)}`,
    ]),
  ] as ['definition' | 'event', string, string][];

export function dialogues(c: Obj, checks: Checks): Diagnostic[] {
  const { named, text } = checks;
  const taken = new Set([
    ...Object.keys(CAPABILITY_OWNERS.command),
    ...[c.actions, c.recipes ?? {}, c.quests ?? {}].flatMap(Object.values).map((d: Obj) => d.key),
  ]);
  const out: Diagnostic[] = [];
  for (const [d, at] of each(c)) {
    if (taken.has(d.key)) out.push(diag('DUPLICATE_DEFINITION', at));
    text(d, ['prompt', 'label'], at);
    if (d.riddle?.wrong_limit !== undefined && !d.quest)
      out.push(diag('OUTCOME_MISMATCH', `${at}.riddle.wrong_limit`));
    if (d.riddle) out.push(...riddle(d, at, checks));
    named(d.npc, 'npc', `${at}.npc`);
    if (d.quest) named(d.quest, 'quest', `${at}.quest`);
    const roles = d.roles as Obj;
    for (const [name, r] of Object.entries(roles)) {
      if (name === 'actor') out.push(diag('DUPLICATE_DEFINITION', `${at}.roles.actor`));
      named(r[r.role], r.role, `${at}.roles${step(name)}.${r.role}`);
    }
    if (!Object.values(roles).some((r) => r.role === 'npc' && same(r.npc, d.npc)))
      out.push(
        diag('UNRESOLVED_REFERENCE', `${at}.npc`, { target: refString(d.npc as DefinitionRef) }),
      );
    if (!Object.keys(d.choices).length)
      out.push(diag('SCHEMA_VIOLATION', `${at}.choices`, { error: 'too_few_items' }));
    for (const [id, o] of Object.entries(d.choices as Obj))
      out.push(...choice(o, `${at}.choices${step(id)}`, d, checks, c));
  }
  return [...out, ...storyPoints(c, named), ...chapters(c, checks)];
}

function riddle(d: Obj, at: string, { text }: Checks): Diagnostic[] {
  const r = d.riddle,
    out: Diagnostic[] = [];
  text(r, ['wrong'], `${at}.riddle`);
  if (!Object.hasOwn(d.choices, r.choice_id))
    out.push(diag('UNRESOLVED_REFERENCE', `${at}.riddle.choice_id`, { target: r.choice_id }));
  const remaining: string[] = [...r.bank];
  for (const letter of r.answer.toUpperCase()) {
    const i = remaining.indexOf(letter);
    if (i < 0) return [...out, diag('OUTCOME_MISMATCH', `${at}.riddle.bank`)];
    remaining.splice(i, 1);
  }
  return out;
}

function storyPoints(c: Obj, named: Checks['named']): Diagnostic[] {
  const out: Diagnostic[] = [];
  const site = (t: Obj) =>
    t.scene
      ? `scene/${refString(t.scene as DefinitionRef)}`
      : `dialogue/${refString(t.dialogue as DefinitionRef)} ${t.choice}`;
  const all = Object.entries((c.story_points ?? {}) as Obj);
  const sites = all.flatMap(([, p]) => Object.values(p.outcomes as Obj).map(site));
  for (const [ref, p] of all) {
    const at = `.cartridge.story_points${step(ref)}`;
    if (!Object.keys(p.outcomes).length)
      out.push(diag('SCHEMA_VIOLATION', `${at}.outcomes`, { error: 'too_few_items' }));
    for (const [name, t] of Object.entries(p.outcomes as Obj)) {
      const path = `${at}.outcomes${step(name)}`;
      if (!!t.scene === !!t.dialogue || (t.scene ? !!t.choice : !t.choice))
        out.push(diag('SCHEMA_VIOLATION', path));
      if (t.scene) {
        named(t.scene, 'scene', `${path}.scene`);
        if (p.key.length > 52) out.push(diag('SCHEMA_VIOLATION', `${at}.key`));
        const scene = (c.scenes ?? {})[refString(t.scene as DefinitionRef)];
        if (
          scene &&
          (scene.on_end?.outcome !== name || refString(scene.on_end.story_point) !== ref)
        )
          out.push(diag('OUTCOME_MISMATCH', path));
      } else named(t.dialogue, 'dialogue', `${path}.dialogue`);
      if (sites.filter((s) => s === site(t)).length > 1)
        out.push(diag('DUPLICATE_DEFINITION', path));
      if (t.scene) continue;
      const d = (c.dialogues ?? {})[refString(t.dialogue as DefinitionRef)];
      if (d && !Object.hasOwn(d.choices, t.choice))
        out.push(diag('UNRESOLVED_REFERENCE', `${path}.choice`, { target: t.choice }));
      if (d && !d.quest) out.push(diag('OUTCOME_MISMATCH', path));
    }
  }
  return out;
}

function chapters(c: Obj, { named, text }: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [i, chapter] of (c.chapters ?? []).entries()) {
    const at = `.cartridge.chapters[${i}]`;
    text(chapter, ['title'], at);
    if (i === 0) {
      for (const field of ['story_point', 'outcome'])
        if (Object.hasOwn(chapter, field)) out.push(diag('UNKNOWN_FIELD', `${at}.${field}`));
      continue;
    }
    if (!chapter.story_point) {
      out.push(diag('SCHEMA_VIOLATION', `${at}.story_point`, { error: 'missing_property' }));
      continue;
    }
    named(chapter.story_point, 'story_point', `${at}.story_point`);
    const point = (c.story_points ?? {})[refString(chapter.story_point)];
    if (!point) continue;
    if (chapter.outcome && !Object.hasOwn(point.outcomes, chapter.outcome)) {
      out.push(diag('UNRESOLVED_REFERENCE', `${at}.outcome`, { target: chapter.outcome }));
      continue;
    }
    const counted: Obj[] = chapter.outcome
      ? [point.outcomes[chapter.outcome]]
      : Object.values(point.outcomes);
    if (counted.some((t) => !t.scene && ambiguous(c, t)))
      out.push(diag('OUTCOME_MISMATCH', `${at}.story_point`));
  }
  return out;
}

function ambiguous(c: Obj, t: Obj): boolean {
  const d = (c.dialogues ?? {})[refString(t.dialogue)];
  return (
    !!d?.quest &&
    each(c).some(
      ([other]) =>
        other !== d &&
        other.quest &&
        same(other.quest, d.quest) &&
        Object.hasOwn(other.choices, t.choice),
    )
  );
}

// One option's texts, fact.assign steps, accept (a quest of this cartridge, in a dialogue that
// resolves none, with no hand_over: OUTCOME_MISMATCH) and hand_over (an item role to an npc role).
// size: allow 52, one authored option validates its mutually constrained effects together
function choice(o: Obj, path: string, d: Obj, { named, typedValue, text }: Checks, c: Obj) {
  const roles = d.roles as Obj;
  const out: Diagnostic[] = [];
  text(o, ['label', 'narration'], path);
  out.push(...patrolChoice(o, d, path, c, { named, typedValue, text }));
  if (o.accept) {
    named(o.accept, 'quest', `${path}.accept`);
    if (d.quest) out.push(diag('OUTCOME_MISMATCH', `${path}.accept`));
    if (o.hand_over) out.push(diag('OUTCOME_MISMATCH', `${path}.hand_over`));
  }
  out.push(...sequence(o, path, c, { named, typedValue, text }));
  if (o.receive) {
    if (o.hand_over) out.push(diag('OUTCOME_MISMATCH', `${path}.receive`));
    for (const [field, role] of [
      ['item', 'item'],
      ['from', 'npc'],
    ])
      if (!Object.hasOwn(roles, o.receive[field]) || roles[o.receive[field]].role !== role)
        out.push(
          diag('UNRESOLVED_REFERENCE', `${path}.receive.${field}`, { target: o.receive[field] }),
        );
  }
  if (o.payment) {
    named(o.payment.resource, 'resource', `${path}.payment.resource`);
    if (roles[o.payment.from]?.role !== 'npc')
      out.push(diag('UNRESOLVED_REFERENCE', `${path}.payment.from`, { target: o.payment.from }));
  }
  if (o.escort) {
    const e = o.escort;
    named(e.quest, 'quest', `${path}.escort.quest`);
    if (!Object.hasOwn(roles, e.npc) || roles[e.npc].role !== 'npc')
      out.push(diag('UNRESOLVED_REFERENCE', `${path}.escort.npc`, { target: e.npc }));
    if (e.transition === 'complete' ? !same(d.quest, e.quest) : d.quest !== undefined)
      out.push(diag('OUTCOME_MISMATCH', `${path}.escort.quest`));
  }
  const h = o.hand_over;
  const wrong = (field: string, role: string) =>
    h && !(Object.hasOwn(roles, h[field]) && roles[h[field]].role === role);
  return out.concat(
    lesson(o, d, path, c, { named, typedValue, text }),
    (['item', 'to'] as const)
      .filter((field) => wrong(field, field === 'to' ? 'npc' : 'item'))
      .map((field) =>
        diag('UNRESOLVED_REFERENCE', `${path}.hand_over.${field}`, { target: h[field] }),
      ),
  );
}
