// The English of engine-owned narration keys, one table for every client (the Book, the terminal
// client, a later telnet client; PM ruling 2026-10-24, loka-kgd.185). The kernel emits only the
// key, its bindings and participants; each entry is [first person, third person], its {slots}
// filled from the line's bindings as the client words them, {actor} with the actor's name.
const LINE_WORDS = new Map<string, readonly [string, string]>([
  ['item.taken', ['You take {item}.', '{actor} takes {item}.']],
  ['item.dropped', ['You drop {item}.', '{actor} drops {item}.']],
  ['item.given', ['You give {item} to {to}.', '{actor} gives {item} to {to}.']],
  ['item.put', ['You put {item} in {container}.', '{actor} puts {item} in {container}.']],
]);

/** A line's sentence from the table, or undefined for a key it lacks. `word` words one binding;
 * `actor` is the acting person's name, absent when the reader acted (first person). */
export const lineSentence = (
  t: { key: string; bindings?: Readonly<Record<string, unknown>> },
  word: (value: unknown) => string,
  actor?: string,
): string | undefined =>
  LINE_WORDS.get(t.key)?.[actor ? 1 : 0].replace(/\{(\w+)\}/g, (_, slot: string) =>
    slot === 'actor' ? actor! : word(t.bindings?.[slot]),
  );
