// What the author panel's State and Why tabs read (docs/system/cartridge.md#author-preview): the view
// with its text keys resolved, and the scripted actions and dialogues this room could offer. Those
// come from the cartridge, not the view: a failing policy is exactly what hides one from the view.
import type { GameView } from '../../packages/game-view/session.ts';

type Ref = { cartridge_id: string; cartridge_version: string; kind: string; key: string };
export type Canon = {
  scripted_actions?: Record<string, { key: string; target?: { kind: string; room?: Ref } }>;
  dialogues?: Record<string, { key: string; npc: Ref }>;
  facts?: Record<string, { key: string; value_type: { default?: unknown } }>;
};
const refString = (r: Ref) => `${r.cartridge_id}@${r.cartridge_version}:${r.kind}/${r.key}`;

export function shown(
  view: GameView,
  text: (key: string) => string | undefined,
  canon: Canon,
  ids: Readonly<Record<string, string>>,
  roomIds: Readonly<Record<string, string>>,
) {
  const say = (key: string) => text(key) ?? key;
  return {
    room: say(view.place.title.key),
    here: Object.keys(roomIds).find((ref) => roomIds[ref] === view.place.id), // the editor's highlight
    people: view.entities.filter((e) => e.kind === 'npc').map((e) => say(e.name)),
    held: view.inventory.map((e) => say(e.name)),
    quests: view.journal.map((q) => ({ quest: q.quest.key, state: q.state })),
    pools: (view.resources ?? []).map((r) => ({
      key: r.resource.key,
      current: r.current,
      maximum: r.maximum,
      band: r.band,
      tone: r.tone,
    })),
    statuses: (view.conditions ?? []).map((c) => ({ label: say(c.label), ends_at: c.ends_at })),
    clock: { time: view.time, calendar: view.calendar_status },
    choice: view.choice && {
      prompt: say(view.choice.prompt.key),
      options: view.choice.choices.map((c) => say(c.label)),
    },
    offers: {
      action: Object.values(canon.scripted_actions ?? {})
        .filter(
          ({ target: t }) =>
            t?.kind !== 'detail' || (t.room && roomIds[refString(t.room)] === view.place.id),
        )
        .map((a) => a.key),
      dialogue: Object.values(canon.dialogues ?? {})
        .filter((d) => view.entities.some((e) => e.id === ids[refString(d.npc)]))
        .map((d) => d.key),
    },
  };
}

/** The clock in words: the calendar's day, hour and sky, else the logical time (seconds) as hours and minutes. */
export function clockWords({
  time,
  calendar,
}: {
  time: number;
  calendar?: GameView['calendar_status'];
}) {
  if (calendar?.day === undefined || calendar.hour === undefined)
    return `${Math.floor(time / 3600)}h ${String(Math.floor((time % 3600) / 60)).padStart(2, '0')}m`;
  const { day, hour, season, solar, lunar, tide, weather } = calendar;
  return [`day ${day}, hour ${hour}`, season, solar, lunar, tide, weather]
    .filter(Boolean)
    .join(', ');
}

/** `cellar_sampler@0.0.11:resource/hp` as `hp`: the name a writer typed. */
export const shortName = (id: string) => id.slice(id.indexOf('/') + 1);

/** Every held fact row by its short key (a per-subject one also names its subject), each declared fact
 * never held at its declared default, then held rows nothing declares. Held rows are keyed by JSON
 * `{fact: Ref, scope, subject_id?, with_id?}`; `id` is the full fact id, `row` keeps them apart. */
export function factRows(held: Readonly<Record<string, unknown>>, declared: Canon['facts'] = {}) {
  const rows = Object.entries(held).map(([row, value]) => {
    const k = JSON.parse(row) as { fact: Ref; subject_id?: string; with_id?: string };
    const id = refString(k.fact);
    const of = [k.subject_id, k.with_id].filter(Boolean).join(', ');
    return { row, id, key: of ? `${k.fact.key} (${of})` : k.fact.key, value, set: true };
  });
  const order = Object.keys(declared);
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  for (const [id, f] of Object.entries(declared))
    if (!rows.some((r) => r.id === id))
      rows.push({ row: id, id, key: f.key, value: f.value_type.default, set: false });
  return rows.sort((a, b) => rank(a.id) - rank(b.id));
}
