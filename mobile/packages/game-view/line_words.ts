// The English of engine-owned narration keys, one table for every client (the Book, the terminal
// client, a later telnet client; PM ruling 2026-10-24, loka-kgd.185). The kernel emits only the
// key, its bindings and participants; each entry is [first person, third person], its {slots}
// filled from the line's bindings as the client words them, {actor} with the actor's name. A third
// and fourth entry are the same without the line's other slots ("You arrive." with no way back).
export const LINE_WORDS = new Map<
  string,
  readonly [string, string] | readonly [string, string, string, string]
>([
  ['item.taken', ['You take {item}.', '{actor} takes {item}.']],
  ['item.dropped', ['You drop {item}.', '{actor} drops {item}.']],
  ['item.given', ['You give {item} to {to}.', '{actor} gives {item} to {to}.']],
  ['item.put', ['You put {item} in {container}.', '{actor} puts {item} in {container}.']],
  ['barrier.opened', ['You open {barrier}.', '{actor} opens {barrier}.']],
  ['barrier.closed', ['You close {barrier}.', '{actor} closes {barrier}.']],
  ['barrier.locked', ['You lock {barrier}.', '{actor} locks {barrier}.']],
  ['barrier.unlocked', ['You unlock {barrier}.', '{actor} unlocks {barrier}.']],
  ['equipment.worn', ['You put on {item}.', '{actor} puts on {item}.']],
  ['equipment.removed', ['You take off {item}.', '{actor} takes off {item}.']],
  ['commerce.bought', ['You buy {item}.', '{actor} buys {item}.']],
  ['commerce.sold', ['You sell {item}.', '{actor} sells {item}.']],
  ['position.stood', ['You stand up.', '{actor} stands up.']],
  ['position.sat', ['You sit down.', '{actor} sits down.']],
  ['position.rested', ['You settle down to rest.', '{actor} settles down to rest.']],
  ['position.slept', ['You lie down to sleep.', '{actor} lies down to sleep.']],
  // The room reached speaks (book-ui Line placement, loka-glj8): {from} is its exit back.
  [
    'movement.moved',
    ['You arrive from {from}.', '{actor} arrives from {from}.', 'You arrive.', '{actor} arrives.'],
  ],
  ['combat.fled', ['You flee {direction}.', '{actor} flees {direction}.']],
  [
    'combat.ran_in',
    ['You run in from {from}.', '{actor} runs in from {from}.', 'You run in.', '{actor} runs in.'],
  ],
]);

/** Where one arrives from, by the exit back: below for a way down, above for a way up, else "the south". */
const FROM: Readonly<Record<string, string>> = { down: 'below', up: 'above' };

/** A line's sentence from the table, or undefined for a key it lacks or a slot its bindings lack
 * (the client then shows the key, never "undefined"). `word` words one binding; `actor` is the
 * acting person's name, absent when the reader acted (first person); `pair` replaces the table's
 * entry (a client's own wording for the same key). */
export const lineSentence = (
  t: { key: string; bindings?: Readonly<Record<string, unknown>> },
  word: (value: unknown) => string,
  actor?: string,
  pair = LINE_WORDS.get(t.key),
): string | undefined => {
  const bound = (words: string) =>
    [...words.matchAll(/\{(\w+)\}/g)].every(
      (m) => m[1] === 'actor' || t.bindings?.[m[1]!] !== undefined,
    );
  const at = actor ? 1 : 0;
  const words = [pair?.[at], pair?.[at + 2]].find((w) => w !== undefined && bound(w));
  return words?.replace(/\{(\w+)\}/g, (_, k: string) =>
    k === 'actor'
      ? actor!
      : k === 'from'
        ? (FROM[String(t.bindings![k])] ?? `the ${word(t.bindings![k])}`)
        : word(t.bindings![k]),
  );
};

/** An emote.performed line's sentence (G9, docs/system/mechanics.md#npc-emotes-g9) from the view's emote
 * table: others when the line has no target, to.you when the target binds no name (the kernel binds none
 * for the reader's own body), else to.others; {actor} is the emoter's name, {target} the binding worded. Undefined for
 * another key or an emote the table lacks. `word` words a text key. */
export const emoteSentence = (
  t: {
    key: string;
    bindings?: Readonly<Record<string, unknown>>;
    participants?: Readonly<Record<string, unknown>>;
  },
  emotes: readonly { key: string; others: string; to?: { others: string; you: string } }[] = [],
  word: (value: unknown) => string,
  actor: string,
): string | undefined => {
  const emote = t.key === 'emote.performed' && emotes.find((e) => e.key === t.bindings?.emote);
  const target = t.bindings?.target;
  const form =
    emote &&
    (t.participants?.target === undefined
      ? emote.others
      : target === undefined
        ? emote.to?.you
        : emote.to?.others);
  return form
    ? word(form)
        .replace(/\{(actor|target)\}/g, (_, k: string) => (k === 'actor' ? actor : word(target)))
        .replace(/^./, (a) => a.toUpperCase())
    : undefined;
};

// An authored line fills its bound slots; an unbound brace stays as written (level-rush rulings).
export const fillSlots = (
  said: string,
  bindings: Record<string, unknown> | undefined,
  word: (v: unknown) => string,
) =>
  said.replace(/\{(\w+)\}/g, (slot, k: string) =>
    bindings?.[k] === undefined ? slot : word(bindings[k]),
  );
