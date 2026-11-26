// The generic sheet (design §6.4, slice 2.3): any source file's fields, drawn from its kind's schema
// by form.tsx (`def:<file>`). The file and its `/schema/<dir>` are read as the panel's Generic card
// reads them; the server validates each write.
import { paired, menuOf } from '../../../../kernel/ts/play/action.ts';
import { cardMenuWith, turnOn } from '../../../../kernel/ts/play/allowed.ts';
import { added, addable, definitionOf } from '../../../../kernel/ts/play/card.ts';
import { refuseNew } from '../../../../kernel/ts/play/choice.ts';
import { change } from '../../../../kernel/ts/play/edit_model.ts';
import { nodeOf } from '../../../../kernel/ts/play/mapedit.ts';
import type { Defs } from '../../../../kernel/ts/play/generic.ts';
import REGISTRY from '../../../../kernel/ts/play/registry.json' with { type: 'json' };
import { choices } from './choices.tsx';
import { combat } from './combat.tsx';
import { block, field } from './form.tsx';
import type { Block, Mechanics, Ops, Write } from './formwrite.ts';
import { known } from './room.tsx';
import { foot, io, refusal } from './roomedit.tsx';
import { lines, pages, scenic } from './scene.tsx';
import { schedule } from './schedule.tsx';
import { sheets } from './sheet.tsx';
import { referrers } from './thing.tsx';
import { world } from './world.tsx';

type Got = { doc: unknown; was: string; kind: string; defs: Defs; root: Record<string, unknown> };
const got = new Map<string, Got>(); // each file with its schema, as last read
const fresh = new Set<string>(); // the files read under the latest /story
let of: unknown; // that /story: a new one reads each file again, showing the old until then
type Cart = Parameters<typeof turnOn>[2] & { calendar?: { hours_per_day?: number } }; // mutate-skip: a type, erased at run time
let cart: { doc: Cart; was: string } | undefined; // cartridge.json as last read: its capabilities gate Add mechanic…

/** `file` and its kind's schema as last read; read again under a new /story, then the Book redraws. */
export function load(file: string) {
  if (of !== known.files) (fresh.clear(), (of = known.files), cartridge());
  if (!fresh.has(file)) {
    fresh.add(file);
    void (async () => {
      const s = await io.source(file);
      const [status, schema] = await known.api!(`/schema/${s.kind}`);
      got.set(file, {
        doc: JSON.parse(s.bytes),
        was: s.sha256,
        kind: s.kind!,
        defs: schema.$defs,
        root: { $ref: schema.$ref },
      });
      known.redraw();
    })().catch(() => {}); // gone or half-written since the /story, or no /schema for its kind: the next /story reads it again
  }
  return got.get(file);
}

function cartridge() {
  io.source('cartridge.json')
    .then((s) => ((cart = { doc: JSON.parse(s.bytes), was: s.sha256 }), known.redraw()))
    .catch(() => ((cart = undefined), known.redraw())); // gone or half-written: no menu until the next /story reads it
}

/** Add mechanic…'s menu for `doc`, once cartridge.json is read: each refused field's turn-on write. */
function mechanics(kind: string, doc: Record<string, unknown>, defs: Defs): Mechanics | undefined {
  if (!cart || Array.isArray(doc)) return undefined;
  const c = cart;
  const menu = addable(kind, REGISTRY, doc, []);
  // an action is offered only its own definition's fields (action.ts `menuOf`; a command action its own)
  const def = Object.hasOwn(doc, 'command') ? COMMAND : undefined;
  const own = kind === 'actions' ? menuOf(menu, defs as never, def) : menu;
  const { allowed, blocked } = cardMenuWith(kind, own, c.doc, doc);
  const on = (f: string) => turnOn(kind, f, c.doc, doc);
  return {
    allowed,
    // a new action (neither `command` nor `outcomes` yet) may still become either: Add… keeps both
    hide: ['command', 'outcomes'].some((f) => Object.hasOwn(doc, f))
      ? menu.filter((f) => !own.includes(f))
      : [],
    blocked: blocked.map((b) => ({
      ...b,
      on: on(b.field) && ['cartridge.json', c.was, on(b.field)!],
    })),
  };
}

const COMMAND = 'source.ActionDefinition'; // a command action's own definition (the panel's Action card)

type Row = { book?: { edit?: string } };
/** The root fields a block draws instead of the form: the registry row's Book edit file. */
function claims(kind: string, doc: Record<string, unknown>) {
  const by: Record<string, Block> = {
    'combat.tsx': combat,
    'schedule.tsx': schedule(doc.room, cart?.doc.calendar?.hours_per_day),
    'choices.tsx': choices(
      doc,
      cart && (cart.doc.requires?.capabilities ?? {}),
      (f) => load(f)?.doc,
    ),
    'scene.tsx': scenic(doc),
    'rules.tsx': block, // the form's unions are the Rules block already (form.tsx `field`)
    'world.tsx': world((f) => load(f)?.doc),
  };
  return (f: string) => by[(REGISTRY as Record<string, Row>)[`${kind}.${f}`]?.book?.edit ?? ''];
}

/** A dialogue's writes pass the compiler's dialogue rules first (choice.ts `refuseNew`, the panel's
 * useGated): a write that adds a refusal is not sent; one whose ops do not apply is left to the server. */
const gate = (kind: string, doc: unknown) => (o: Ops) => {
  if (kind !== 'dialogues') return undefined;
  const after = structuredClone(doc) as Record<string, unknown>;
  try {
    change(after, o);
  } catch {
    // change() rolls back: `after` stays `doc`, so no refusal is added
  }
  return refuseNew(doc as Record<string, unknown>, after, known.hidden);
};

/** A scripted action's write brings its failure outcome with its check, or drops it with the check
 * (action.ts `paired`, the panel's Action card): one more op on `outcomes`, in the same /change. */
// only an action has a root `outcomes` (paired leaves every other doc as it is)
const pair = (doc: unknown, defs: Defs) => (o: Ops) => {
  const after = structuredClone(doc) as Record<string, unknown>;
  try {
    change(after, o);
  } catch {
    return o; // ops that do not apply are left to the server
  }
  const both = paired(after, defs as never);
  if (both === after) return o;
  return [
    ...o.filter((x) => x.path[0] !== 'outcomes'),
    { path: ['outcomes'], value: both.outcomes },
  ];
};

/** A source file's sheet: its definition's fields, each written as it is entered. */
function body(file: string) {
  if (file.endsWith('.scene')) return [refusal(), lines(file)]; // no JSON: its lines (scene.tsx)
  const g = load(file);
  if (!g) return refusal();
  const def = definitionOf(g.defs, g.kind, g.doc);
  const doc = g.doc as Record<string, unknown>;
  const seed = (f: string) => (Array.isArray(doc) ? undefined : added(doc, f, g.defs, def)?.[f]);
  const mech = mechanics(g.kind, doc, g.defs);
  const claim = claims(g.kind, doc);
  const at = {
    file,
    was: g.was,
    defs: g.defs,
    seen: [],
    seed,
    mech,
    claim,
    gate: gate(g.kind, doc),
    pair: pair(doc, g.defs),
    kind: g.kind,
  };
  // a scene's `.cut` twin, when it has one: its pages above its fields
  const cut = g.kind === 'scenes' && pages(file.replace(/\.json$/, '.cut'), 'steps' in doc);
  const key = file.replace(/^.*\//, '').replace(/\.\w+$/, '');
  // a root file (cartridge.json, layout.json) is never deleted whole (write.ts remove()): no foot
  const drop =
    file.includes('/') && foot(key, file, `def:${file}`, referrers(nodeOf(g.kind), key, file));
  return [refusal(), cut, field(at, [], g.root, g.doc), drop];
}

sheets.def = { title: (file) => file, body };
