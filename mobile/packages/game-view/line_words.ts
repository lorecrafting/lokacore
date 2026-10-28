// The English of engine-owned narration keys, one table for every client (the Book, the terminal
// client, a later telnet client; PM ruling 2026-10-24, loka-kgd.185). The kernel emits only the
// key, its bindings and participants; each entry is [first person, third person], its {slots}
// filled from the line's bindings as the client words them, {actor} with the actor's name. A third
// and fourth entry are the same without the line's other slots ("You arrive." with no way back).
export const LINE_WORDS = new Map<string, readonly string[]>([
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
