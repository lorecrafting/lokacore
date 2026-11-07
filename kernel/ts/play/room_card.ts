// The Room card's details logic (docs/rnd/gui-editor-design-2026-11-04.md §6; cards hold no logic).
// Re-exported by card.ts.
type Obj = Record<string, unknown>;
const plain = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `doc` with each detail the draft `was` lacks given what InspectableDetail requires and no word
 * invented (loka-wfrgk.76): a `~` description, and its key as its one alias once the key is one
 * (starters/templates.ex:164 writes `aliases: [name]`); rjsf's `newKey` placeholder is not. A
 * renamed detail's alias follows its key only while it was the old key; a kept one is never refilled. */
export function detailed(was: Obj, doc: Obj, defs: Record<string, Obj>): Obj {
  const had = plain(was.details) ? was.details : {};
  if (!plain(doc.details)) return doc;
  const now = doc.details;
  const alias = new RegExp(defs.Alias.pattern as string);
  const fill = (k: string, d: Obj) => {
    const [a, ...more] = (d.aliases ?? []) as string[];
    const old = !more.length && Object.hasOwn(had, a) && !Object.hasOwn(now, a); // its key before the rename
    return {
      ...d,
      description: d.description ?? { prose: '~' },
      ...(!a || old ? (alias.test(k) ? { aliases: [k] } : old && { aliases: [] }) : {}),
    };
  };
  const each = Object.entries(now).map(([k, d]) => [
    k,
    Object.hasOwn(had, k) || !plain(d) ? d : fill(k, d),
  ]);
  return { ...doc, details: Object.fromEntries(each) };
}
