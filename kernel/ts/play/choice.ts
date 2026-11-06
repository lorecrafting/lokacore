// The Dialogue card's choice tree (docs/rnd/gui-editor-design-2026-11-04.md §4.4): what a dialogue's
// choices hold together, as the compiler accepts them. The card draws; this decides.
import { allowed, teaches } from './allowed.ts';
import { proseKey } from './card.ts';

type Obj = Record<string, unknown>;
const has = (o: Obj, f: string) => Object.hasOwn(o, f);
const choicesOf = (doc: Obj) => (doc.choices ?? {}) as Record<string, Obj>;

/** The badges a folded choice shows: what gates or charges taking it. */
export const BADGES = ['policy', 'once', 'accept', 'hand_over', 'payment'];

// a .scene choice's slug is its words (loka-vduxr.51); every reference names the key
export const RENAME =
  "a choice's key is its id: links, story points, reactions and saves name it, so it is not renamed (add a choice instead)";

// check_kinds.ex:18: the fields a check choice carries
const PLAIN = [
  'label',
  'narration',
  'narration_variants',
  'asked_when',
  'steps',
  'availability',
  'check',
  'policy',
  'then',
  'then_failed',
];
// patrol.ex:165-168: the fields a patrol choice never carries
const UNPATROLLED = ['escort', 'sequence', 'payment', 'lesson_payment', 'receive', 'hand_over'];

/** Why choice `k` (`c`) of dialogue `doc` would not compile. */
function* refusedChoice(doc: Obj, k: string, c: Obj) {
  // dialogues.ex:367
  if (has(c, 'accept') && has(doc, 'quest'))
    yield `${k}: accept would resolve this dialogue's own quest`;
  // dialogues.ex:368
  if (has(c, 'accept') && has(c, 'hand_over'))
    yield `${k}: accept and hand_over do not go together`;
  // dialogues.ex:386
  if (has(c, 'receive') && has(c, 'hand_over'))
    yield `${k}: receive and hand_over do not go together`;
  // dialogue_links.ex:45
  if (has(c, 'then_failed') && !has(c, 'check')) yield `${k}: then_failed needs a check`;
  // dialogue_links.ex:393
  if (has(c, 'patrol') && [c.then, c.then_failed].some((t) => t !== undefined && t !== 'end'))
    yield `${k}: a patrol ends the talk: no then`;
  // dialogue_asked.ex:32, :41 (only `asked: true` is asked)
  if (c.asked === true && (doc.riddle as Obj | undefined)?.choice_id === k)
    yield `${k}: the riddle's answer is never asked`;
  // check_kinds.ex:151-157
  const odd = has(c, 'check') && Object.keys(c).find((f) => !PLAIN.includes(f));
  if (odd) yield `${k}: a check choice carries no ${odd}`;
  const around = ['quest', 'riddle'].find((f) => has(doc, f));
  if (has(c, 'check') && around)
    yield `${k}: a check choice is never in a dialogue with a ${around}`;
  // patrol.ex:160
  if (has(c, 'patrol') && has(doc, 'quest'))
    yield `${k}: a patrol choice is never in a dialogue with a quest`;
  const off = has(c, 'patrol') && UNPATROLLED.find((f) => has(c, f));
  if (off) yield `${k}: patrol and ${off} do not go together`;
  // skills.ex:275
  if (has(c, 'lesson_payment') && has(c, 'payment'))
    yield `${k}: lesson_payment and payment do not go together`;
}

/** Why the dialogue `doc` would not compile for what its choices hold, every reason.
 * `hidden` are the hidden skills' keys. Fields count by presence, as the compiler's is_map_key does. */
function refusals(doc: Obj, hidden: string[]): string[] {
  const why = Object.entries(choicesOf(doc)).flatMap(([k, c]) => [...refusedChoice(doc, k, c)]);
  const named = ['name', 'riddle'].find((f) => has(doc, f));
  // skills.ex:157-158
  if (teaches(doc, hidden) && named) why.push(`a dialogue with a ${named} teaches no hidden skill`);
  return why;
}

/** Why the dialogue `doc` would not compile for what its choices hold; undefined when it would. */
export const refuseChoices = (doc: Obj, hidden: string[] = []) => refusals(doc, hidden)[0];

/** The first refusal `after` has that `before` has not: a dialogue already broken stays editable. */
export function refuseNew(before: Obj, after: Obj, hidden: string[] = []): string | undefined {
  const old = refusals(before, hidden);
  return refusals(after, hidden).find((r) => !old.includes(r));
}

/** Why choice `k` cannot be removed from `doc`; undefined when it can. */
export function refuseRemove(doc: Obj, k: string): string | undefined {
  // dialogues.ex:315, :288
  if (Object.keys(choicesOf(doc)).length === 1) return 'a dialogue keeps one choice at least';
  return (doc.riddle as Obj | undefined)?.choice_id === k
    ? `the riddle's answer is ${k}`
    : undefined;
}

/** `doc` with choice `k` set to `c` (undefined: removed). */
export function withChoice(doc: Obj, k: string, c?: Obj): Obj {
  const { [k]: _gone, ...rest } = choicesOf(doc);
  return { ...doc, choices: c ? { ...choicesOf(doc), [k]: c } : rest };
}

/** The fields of `menu` choice `k` can take without a new refusal, each tried present as `[]`
 * (steps is read as a list; `asked` as true, the one value worth adding) and its capability declared
 * in `caps` (allowed.ts); never `order`, a scene's mark the compiler writes (scene_merge.ex:56-57). */
export const choiceMenu = (
  doc: Obj,
  k: string,
  menu: string[],
  caps: object,
  hidden: string[] = [],
) =>
  allowed('dialogues.choices', menu, caps).filter(
    (f) =>
      f !== 'order' &&
      !has(choicesOf(doc)[k], f) &&
      !refuseNew(
        doc,
        withChoice(doc, k, { ...choicesOf(doc)[k], [f]: f === 'asked' || [] }),
        hidden,
      ),
  );

/** What a `then` to dialogue `key` (`doc`) shows folded when it is a nested set, `entry: false`, which
 * only a then opens (mechanics.md Links): its prompt's and choices' text keys, and where those lead. */
export const nested = (doc: Obj | undefined, key: string) =>
  doc?.entry === false
    ? {
        prompt: proseKey(doc.prompt, 'dialogue', key, ['prompt']),
        choices: Object.entries(choicesOf(doc)).map(([k, c]) => ({
          label: proseKey(c.label, 'dialogue', key, ['choices', k, 'label']),
          then: c.then as string | undefined,
        })),
      }
    : undefined;
