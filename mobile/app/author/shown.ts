// What the author panel's State and Why tabs read (docs/system/cartridge.md#author-preview): the view
// with its text keys resolved, and the scripted actions and dialogues this room could offer. Those
// come from the cartridge, not the view: a failing policy is exactly what hides one from the view.
import type { GameView } from '../../packages/game-view/session.ts';

type Ref = { cartridge_id: string; cartridge_version: string; kind: string; key: string };
export type Canon = {
  scripted_actions?: Record<string, { key: string; target?: { kind: string; room?: Ref } }>;
  dialogues?: Record<string, { key: string; npc: Ref }>;
};
const refString = (r: Ref) => `${r.cartridge_id}@${r.cartridge_version}:${r.kind}/${r.key}`;

export function shown(
  view: GameView,
  text: (key: string) => string | undefined,
  canon: Canon,
  ids: Readonly<Record<string, string>>,
) {
  const say = (key: string) => text(key) ?? key;
  const inRoom = (ref: Ref) => view.entities.some((e) => e.id === ids[refString(ref)]);
  return {
    room: say(view.place.title.key),
    people: view.entities.filter((e) => e.kind === 'npc').map((e) => say(e.name)),
    held: view.inventory.map((e) => say(e.name)),
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
            t?.kind !== 'detail' || (t.room && ids[refString(t.room)] === view.place.id),
        )
        .map((a) => a.key),
      dialogue: Object.values(canon.dialogues ?? {})
        .filter((d) => inRoom(d.npc))
        .map((d) => d.key),
    },
  };
}
