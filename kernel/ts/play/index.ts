// size: allow 320, the two generated pages share one compile, one ref walk and one grouping table: the root page's counts, borders, entry and root names, and an area's sections and crossings
// The generated area index (docs/system/cartridge.md#content-reports): `bin/loka index <cartridge dir>`
// writes `areas/INDEX.md` and one `areas/<area>/INDEX.md`, so an agent reads a world's shape before it
// opens a file (docs/BUILDERS-GUIDE.md#cartridge-layout). It compiles the source as `check.ts` does,
// reads the artifact's refs (`find.ts`'s walk) and takes each definition's area from its source path;
// it never reads prose. `bin/regen.sh` runs it for every changed cartridge, and a stale index fails
// REGEN_DIRTY like the other generated files (docs/CHECKS.md).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isObj, type Obj } from '../src/content/cartridge_refs.ts';
import { compiled } from './compiled.ts';
import { refsIn } from './find.ts';
import { DIRS, placed } from './guard.ts';
import { bundled, files } from './todo.ts';

export type Dev = { canonical: string; sha256: string };
type Place = { kind: string; dir: string; key: string; area: string | null };
type Def = Place & { body: Obj };
type Cross = { from: Def; at: string; to: Def };

// The header table's columns and the per-area sections, in order; every other definition folder is
// `other` in the table and `Other` in a section (a barrier, an action, a status...).
const GROUPS: { column: string; heading: string; dirs: string[] }[] = [
  { column: 'rooms', heading: 'Rooms', dirs: ['rooms'] },
  { column: 'npcs', heading: 'NPCs', dirs: ['npcs'] },
  { column: 'items', heading: 'Items', dirs: ['items'] },
  { column: 'quests', heading: 'Quests', dirs: ['quests'] },
  { column: 'dialogues', heading: 'Dialogues and scenes', dirs: ['dialogues', 'scenes'] },
  { column: 'reactions', heading: 'Reactions', dirs: ['reactions'] },
];
// The field naming where a definition sits; the first ref in it is its placement.
const PLACE: Record<string, string> = {
  npcs: 'room',
  items: 'location',
  populations: 'home',
  replenish: 'from',
  transports: 'room',
  reactions: 'on.room',
};

// A scripted action's file is `actions/<key>.json`; the compiler routes it to `scripted_actions`.
const dirOf = (section: string) => (section === 'scripted_actions' ? 'actions' : section);
/** A name as the index writes it: `<area>/<key>` for an area's, `<dir>/<key>` for the root's. */
const where = (p: Place) => `${p.area ?? p.dir}/${p.key}`;
const byKey = (a: Place, b: Place) => (a.key < b.key ? -1 : 1);

/** Each source definition's area by `<dir>/<key>`: its folder (`areas/<a>/`), its bundle's, or none. */
function areasOf(source: string) {
  const at = new Map<string, string | null>();
  for (const rel of files(source)) {
    const p = placed(rel);
    if (p) at.set(`${p.dir}/${p.key}`, p.area);
  }
  for (const [addr, rel] of Object.entries(bundled(source))) at.set(addr, basename(rel, '.json'));
  return at;
}

/** Every definition of a definition folder the artifact holds, in its order, with its area. */
function definitions(dev: Dev, source: string): Def[] {
  const at = areasOf(source);
  const out: Def[] = [];
  for (const [section, value] of Object.entries(JSON.parse(dev.canonical) as Obj)) {
    const dir = dirOf(section);
    if (!DIRS.includes(dir) || !isObj(value)) continue;
    for (const [full, body] of Object.entries(value)) {
      const [, kind, key] = /^[^@]+@[^:]+:([a-z_]+)\/(.+)$/.exec(full) ?? [];
      if (!kind || !key || !isObj(body)) continue;
      out.push({ kind, dir, key, body, area: at.get(`${dir}/${key}`) ?? null });
    }
  }
  return out;
}

/** Every name from one definition to another, by the field path that makes it. */
function crossings(defs: Def[]): Cross[] {
  const at = new Map(defs.map((d) => [`${d.kind}/${d.key}`, d]));
  return defs.flatMap((from) =>
    refsIn(from.body).flatMap((r) => {
      const to = at.get(`${r.kind}/${r.key}`);
      return to && to !== from ? [{ from, at: r.at, to }] : [];
    }),
  );
}

// The word before a placement: how a definition of this folder names where it sits.
const SITS: Record<string, string> = { location: 'in', home: 'at', from: 'from', 'on.room': 'on' };

/** Where a definition sits: `@<room>` for a placement, else `held by`/`in`/`from`/`at` its holder,
 * each naming `<area>/<key>` when it crosses. A template item sits nowhere. */
function placedAt(d: Def, cross: Cross[]) {
  const field = PLACE[d.dir];
  if (!field) return '';
  const to = cross.find((c) => c.from === d && c.at.startsWith(field))?.to;
  if (!to) return d.body.location?.in === 'template' ? ' template' : '';
  const name = to.area === d.area ? to.key : where(to);
  if (to.kind === 'room') return ` @${name}`;
  return ` ${to.kind === 'npc' ? 'held by' : (SITS[field] ?? field)} ${name}`;
}

/** A room's line: its key, its drawing spot and entry mark, then each exit (`->` when it crosses). */
function roomLine(d: Def, cross: Cross[], spot?: number[], entry?: string) {
  const exits = Object.keys(isObj(d.body.exits) ? d.body.exits : {}).flatMap((dir) => {
    const to = cross.find((c) => c.from === d && c.at === `exits.${dir}.to`)?.to;
    if (!to) return [];
    return [`${dir} ${to.area === d.area ? to.key : `-> ${where(to)}`}`];
  });
  const spotText = spot ? ` (${spot.join(',')})` : '';
  return `${d.key}${spotText}${entry === d.key ? ' [entry]' : ''}  exits: ${exits.join(', ') || 'none'}`;
}

/** A definition's line: its key (address outside a table column), its placement, then each name it
 * makes outside its own area. */
function line(d: Def, cross: Cross[], spot?: number[], entry?: string) {
  if (d.dir === 'rooms') return roomLine(d, cross, spot, entry);
  const field = PLACE[d.dir];
  const names = cross
    .filter((c) => c.from === d && c.to.area !== d.area && !(field && c.at.startsWith(field)))
    .map((c) => `${c.at} -> ${where(c.to)}`);
  const key = GROUPS.some((g) => g.dirs.includes(d.dir)) ? d.key : `${d.dir}/${d.key}`;
  return `${key}${placedAt(d, cross)}${names.length ? `  ${names.join(', ')}` : ''}`;
}

/** One heading per group that holds one, with its count, then one line per definition. */
function sections(mine: Def[], cross: Cross[], spot: Map<string, number[]>, entry?: string) {
  const out: string[] = [];
  const extra = { column: 'other', heading: 'Other', dirs: [] };
  for (const { heading, dirs } of [...GROUPS, extra]) {
    const held = mine
      .filter((d) =>
        dirs.length ? dirs.includes(d.dir) : !GROUPS.some((g) => g.dirs.includes(d.dir)),
      )
      .sort(byKey);
    if (!held.length) continue;
    out.push('', `## ${heading} (${held.length})`);
    out.push(...held.map((d) => line(d, cross, spot.get(d.key), entry)));
  }
  return out;
}

/** What sits outside an area and names it, and what inside names elsewhere: the area's crossings. */
function borders(area: string, own: Def[], cross: Cross[]) {
  const out = cross
    .filter((c) => c.from.area === area && c.to.area && c.to.area !== area)
    .map((c) => `${c.from.key}.${c.at} -> ${where(c.to)}`);
  const fromRoot = cross
    .filter((c) => c.to.area === area && c.from.area === null)
    .map((c) => `${where(c.to)} <- ${c.from.dir}/${c.from.key} (${c.at})`);
  const toRoot = [
    ...new Set(
      cross.filter((c) => c.from.area === area && c.to.area === null).map((c) => where(c.to)),
    ),
  ];
  const naming = (root: string) =>
    own.filter((d) => cross.some((c) => c.from === d && where(c.to) === root)).map((d) => d.key);
  return [
    ...(out.length ? [`Names other areas' rooms: ${out.join('; ')}`] : []),
    ...(fromRoot.length ? [`Named from the root: ${fromRoot.join('; ')}`] : []),
    ...(toRoot.length
      ? [
          `Names the root: ${toRoot.map((root) => `${root} (${naming(root).join(', ')})`).join('; ')}`,
        ]
      : []),
  ];
}

/** The room-to-room borders of the whole world: each exit that crosses, then each transport whose
 * boarding room and destination sit in two areas (docs/rnd design section 6, `Borders`). */
function worldBorders(cross: Cross[]) {
  const side = (area: string | null) => area ?? '(root)';
  const exits = cross
    .filter((c) => c.from.kind === 'room' && c.to.kind === 'room' && c.to.area !== c.from.area)
    .filter((c) => /^exits\.[a-z_]+\.to$/.test(c.at))
    .map((c) => `${side(c.from.area)} --${c.from.key} ${c.at.split('.')[1]}--> ${where(c.to)}`);
  const transports = [
    ...new Set(cross.filter((c) => c.from.kind === 'transport').map((c) => c.from)),
  ].flatMap((t) => {
    const room = cross.find((c) => c.from === t && c.at === 'room')?.to;
    const to = cross.find((c) => c.from === t && c.at === 'destination')?.to;
    if (!room || !to || room.area === to.area) return [];
    return [`${side(room.area)} --${t.key}--> ${where(to)}`];
  });
  return [...exits, ...transports].sort();
}

/** The root definitions an area names, and which areas name each root definition. */
function rootNames(defs: Def[], cross: Cross[]) {
  return defs
    .filter((d) => d.area === null)
    .map((d) => ({
      where: where(d),
      areas: [
        ...new Set(cross.filter((c) => c.to === d && c.from.area).map((c) => c.from.area!)),
      ].sort(),
    }))
    .sort((a, b) => (a.where < b.where ? -1 : 1));
}

/** A Markdown table, each column as wide as its widest cell. */
function table(rows: string[][]) {
  const wide = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));
  const rule = rows[0]!.map((_, i) => '-'.repeat(wide[i]!));
  return [rows[0]!, rule, ...rows.slice(1)]
    .map((r) => `| ${r.map((cell, i) => cell.padEnd(wide[i]!)).join(' | ')} |`)
    .join('\n');
}

/** The three header lines the owner asked for: what this is, that it is generated, and the rules. */
const header = (what: string, up: string) => [
  `# ${what}`,
  'Generated by bin/loka index; do not edit: bin/regen.sh rewrites it.',
  `An area folder's rules: [Cartridge layout](${up}docs/BUILDERS-GUIDE.md#cartridge-layout).`,
];

/** `areas/INDEX.md`: a row per area (its own index linked), the borders, the entry and the root's names. */
function areasPage(id: string, areas: string[], defs: Def[], cross: Cross[], entry?: Place) {
  const count = (mine: Def[]) => [
    ...GROUPS.map((g) => String(mine.filter((d) => g.dirs.includes(d.dir)).length)),
    String(mine.filter((d) => !GROUPS.some((g) => g.dirs.includes(d.dir))).length),
  ];
  const row = (name: string, mine: Def[]) => [name, ...count(mine)];
  const rows = [
    ['area', ...GROUPS.map((g) => g.column), 'other'],
    ...areas.map((a) =>
      row(
        `[${a}](${a}/INDEX.md)`,
        defs.filter((d) => d.area === a),
      ),
    ),
    row(
      '(root)',
      defs.filter((d) => d.area === null),
    ),
  ];
  const out = [...header(`The areas of ${id}`, '../../../'), '', table(rows)];
  const borders = worldBorders(cross);
  if (borders.length) out.push('', `Borders (exit or transport): ${borders.join('; ')}`);
  if (entry) out.push(`Entry: ${where(entry)}`);
  const named = rootNames(defs, cross);
  const shared = named.filter((r) => r.areas.length > 1);
  if (shared.length)
    out.push(
      '',
      `Root definitions named by two or more areas: ${shared.map((r) => `${r.where} (${r.areas.join(', ')})`).join('; ')}`,
    );
  const alone = named.filter((r) => !r.areas.length);
  if (alone.length)
    out.push('', `Root definitions named by no area: ${alone.map((r) => r.where).join('; ')}`);
  return `${out.join('\n')}\n`;
}

/** The index files a cartridge's source needs, by relative path; none when it has no `areas/` folder. */
export function indexes(source: string, dev: Dev): Record<string, string> | null {
  if (!existsSync(join(source, 'areas'))) return null;
  const raw = JSON.parse(dev.canonical) as Obj;
  const id = String(raw.manifest?.id ?? '');
  const defs = definitions(dev, source);
  const cross = crossings(defs);
  const spot = new Map(
    (Array.isArray(raw.layout) ? raw.layout : []).flatMap((r) =>
      isObj(r) && isObj(r.room) ? [[String(r.room.key), [r.x, r.y, r.z] as number[]]] : [],
    ),
  );
  const entry = isObj(raw.entry)
    ? {
        kind: 'room',
        dir: 'rooms',
        key: String(raw.entry.key),
        area: defs.find((d) => d.key === raw.entry!.key && d.dir === 'rooms')?.area ?? null,
      }
    : undefined;
  const areas = [...new Set(defs.flatMap((d) => (d.area ? [d.area] : [])))].sort();
  const out: Record<string, string> = {
    'areas/INDEX.md': areasPage(id, areas, defs, cross, entry),
  };
  for (const area of areas) {
    const own = defs.filter((d) => d.area === area);
    const crosses = borders(area, own, cross);
    out[`areas/${area}/INDEX.md`] =
      [
        ...header(`The area ${area} of ${id}`, '../../../../'),
        ...sections(own, cross, spot, entry?.key),
        ...(crosses.length ? ['', '## Crosses the border', ...crosses] : []),
      ].join('\n') + '\n';
  }
  return out;
}

/** Writes the index files; a cartridge with no area gets none, and nothing is ever deleted. An area
 * known only as a bundle (`areas/village.json`) gets its folder here, for its one file. */
export function writeIndexes(source: string, dev: Dev): string[] {
  const pages = indexes(source, dev) ?? {};
  for (const [rel, bytes] of Object.entries(pages)) {
    mkdirSync(dirname(join(source, rel)), { recursive: true });
    writeFileSync(join(source, rel), bytes);
  }
  return Object.keys(pages);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, ...rest] = process.argv.slice(2);
  if (!dir || rest.length) {
    console.error('usage: bin/loka index <cartridge dir>');
    process.exit(2);
  }
  const source = resolve(dir);
  const dev = compiled(source);
  if (typeof dev === 'string') {
    console.error(dev);
    process.exit(1);
  }
  const written = writeIndexes(source, dev);
  if (!written.length) console.error(`no areas/ folder in ${dir}: nothing to index`);
  else for (const rel of written) console.log(rel);
}
