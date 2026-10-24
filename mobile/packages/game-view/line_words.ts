// The English of engine-owned narration keys, one table for every client (the Book, the terminal
// client, a later telnet client; PM ruling 2026-10-24, loka-kgd.185). The kernel emits only the
// key, its bindings and participants; each entry is [first person, third person], its {slots}
// filled from the line's bindings as the client words them, {actor} with the actor's name.
export const LINE_WORDS = new Map<string, readonly [string, string]>([
  ['item.taken', ['You take {item}.', '{actor} takes {item}.']],
  ['item.dropped', ['You drop {item}.', '{actor} drops {item}.']],
  ['item.given', ['You give {item} to {to}.', '{actor} gives {item} to {to}.']],
  ['item.put', ['You put {item} in {container}.', '{actor} puts {item} in {container}.']],
  ['barrier.opened', ['You open {barrier}.', '{actor} opens {barrier}.']],
  ['barrier.closed', ['You close {barrier}.', '{actor} closes {barrier}.']],
  ['barrier.locked', ['You lock {barrier}.', '{actor} locks {barrier}.']],
  ['barrier.unlocked', ['You unlock {barrier}.', '{actor} unlocks {barrier}.']],
  ['equipment.worn', ['You put it on.', '{actor} puts on {item}.']],
  ['equipment.removed', ['You take it off.', '{actor} takes off {item}.']],
  ['position.stood', ['You stand up.', '{actor} stands up.']],
  ['position.sat', ['You sit down.', '{actor} sits down.']],
  ['position.rested', ['You settle down to rest.', '{actor} settles down to rest.']],
  ['position.slept', ['You lie down to sleep.', '{actor} lies down to sleep.']],
  ['movement.moved', ['You go {direction}.', '{actor} goes {direction}.']],
]);

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
  const words = pair?.[actor ? 1 : 0];
  const slots = [...(words ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
  if (!words || slots.some((k) => k !== 'actor' && t.bindings?.[k] === undefined)) return undefined;
  return words.replace(/\{(\w+)\}/g, (_, k: string) =>
    k === 'actor' ? actor! : word(t.bindings![k]),
  );
};
