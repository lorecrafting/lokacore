// The loader's touch-link check (the compiler's twin is lib/loka/content/links.ex; owner decision
// 2026-09-25 Q3; text.schema.json TextCatalog; DiagnosticCode UNRESOLVED_REFERENCE). The
// compiler's TOUCH_LINK_MISSING is a warning, and the loader reports only errors, so it stays
// compiler-only.
import type { Diagnostic } from './contracts.gen.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';

const LINK = /\[([^[\]]+)\](?:\(([^()]*)\))?/g;

type Use = [path: string, key: string, self: string | undefined, targets: string[]];

/**
 * UNRESOLVED_REFERENCE for each touch link, in the catalog string of a room's title,
 * description or variant, a detail's description or variant, or an item's or NPC's short,
 * room line, room-line variant or description, whose target is not the thing whose text it is
 * (a link without a target key), a detail of the room (room and detail texts), or an item or
 * NPC of the cartridge; data {target} the key, or the link as written in a room's own text.
 */
export function links(c: Obj): Diagnostic[] {
  const entities = ['npcs', 'items'].flatMap((m) =>
    Object.values((c[m] ?? {}) as Obj).map((e) => e.key as string),
  );
  const uses: Use[] = [];
  for (const [ref, r] of Object.entries(c.rooms as Obj)) {
    const at = `.cartridge.rooms${step(ref)}`;
    const targets = [...entities, ...Object.keys(r.details ?? {})];
    const own = (d: Obj, p: string, self?: string) => {
      uses.push([`${p}.description`, d.description, self, targets]);
      (d.variants ?? []).forEach((v: Obj, i: number) =>
        uses.push([`${p}.variants[${i}].description`, v.description, self, targets]),
      );
    };
    uses.push([`${at}.title`, r.title, undefined, targets]);
    own(r, at);
    for (const [k, d] of Object.entries((r.details ?? {}) as Obj))
      own(d, `${at}.details${step(k)}`, k);
  }
  for (const map of ['npcs', 'items'])
    for (const [ref, e] of Object.entries((c[map] ?? {}) as Obj)) {
      const at = `.cartridge.${map}${step(ref)}`;
      for (const f of ['short', 'room_line', 'description'])
        uses.push([`${at}.${f}`, e[f], e.key, entities]);
      (e.room_line_variants ?? []).forEach((v: Obj, i: number) =>
        uses.push([`${at}.room_line_variants[${i}].description`, v.description, e.key, entities]),
      );
    }
  return uses.flatMap(([at, key, self, targets]) =>
    [...(Object.hasOwn(c.text, key) ? (c.text[key] as string) : '').matchAll(LINK)].flatMap(
      ([, words, t]) => {
        const target = t ?? self;
        const ok = target !== undefined && (target === self || targets.includes(target));
        return ok ? [] : [diag('UNRESOLVED_REFERENCE', at, { target: target ?? `[${words}]` })];
      },
    ),
  );
}
