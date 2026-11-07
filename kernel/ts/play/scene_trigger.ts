// A modal scene's trigger (loka-wfrgk.107; cards hold no logic): what may start it, offered only as
// the compile accepts it (lib/loka/content/scenes.ex), and the starter's quest a switch leaves.
import { choices } from './world_card.ts';

type Obj = Record<string, unknown>;
type Nodes = { ref: string; kind: string }[];
export type On = Record<string, unknown>;
export type Kind = 'start' | 'story_point' | 'quest' | 'action';
/** The story model's part (story.ts): what the compiled cartridge lets a trigger name. */
export type Triggers = {
  points: Record<string, string[]>; // story point key => its outcomes (scenes.ex:241-257)
  actions: Record<string, { room: string; detail: string }>; // a detail's scripted action => its target (scenes.ex:174-181)
  taken: Record<string, string>; // modal scene key => its on, as `same` writes it (scenes.ex:274-292)
  named: Record<string, string[]>; // quest key => the refs of the nodes naming it
};

const key = (v: unknown) => (v && typeof v === 'object' ? (v as Obj).key : v);
const tail = (ref: string) => ref.slice(ref.lastIndexOf(':') + 1);
/** One on's identity: scenes.ex:274-292 refuses two scenes with the same one (every start is one). */
const same = (on: On) =>
  JSON.stringify(
    Object.keys(on)
      .sort()
      .map((k) => [k, key(on[k])]),
  );

/** The trigger's kind, in Scenes.trigger_kind's order (scenes.ex:140-147). */
export const kindOf = (on: On = {}): Kind =>
  'action' in on ? 'action' : 'quest' in on ? 'quest' : 'start' in on ? 'start' : 'story_point';

export function triggers(c: Obj, edges: { from: string; to: string }[]): Triggers {
  const of = (field: string) => Object.values((c[field] ?? {}) as Record<string, Obj>);
  const points = Object.fromEntries(
    of('story_points').map((p) => [key(p.key) ?? '', Object.keys((p.outcomes ?? {}) as Obj)]),
  );
  const details = new Map(of('rooms').map((r) => [r.key, (r.details ?? {}) as Obj]));
  const actions: Triggers['actions'] = {};
  for (const a of of('scripted_actions')) {
    const t = (a.target ?? {}) as Obj;
    const [room, detail] = [key(t.room) as string, t.detail as string];
    // scenes.ex:174-181: the target's room has the detail the on names
    if (t.kind === 'detail' && detail in (details.get(room) ?? {}))
      actions[a.key as string] = { room, detail };
  }
  const taken: Record<string, string> = {};
  for (const s of of('scenes'))
    if (!('rest' in ((s.on ?? {}) as Obj))) taken[s.key as string] = same(s.on as On);
  const named: Record<string, string[]> = {};
  for (const q of of('quests')) named[q.key as string] = [];
  for (const e of edges)
    if (tail(e.to).startsWith('quest/')) (named[tail(e.to).slice(6)] ??= []).push(tail(e.from));
  return { points, actions, taken, named };
}

/** Every on the compile would take for scene `scene`, by kind, first the one a switch writes; an on
 * another scene has is not offered (scenes.ex:274-292), nor a key outside `nodes` (area rules). A
 * quest's outcome is free (scenes.ex never checks it): the starter's `completed` is offered. */
export function offers(t: Triggers, scene: string, nodes: Nodes): Record<Kind, On[]> {
  const free = (ons: On[]) => ons.filter((on) => !refused(t, scene, on));
  const has = (kind: string, keys: Record<string, unknown>) =>
    choices(kind, nodes).filter((k) => k in keys);
  return {
    // scenes.ex:149-156: start takes no outcome; an action names its room and detail and succeeds
    start: free([{ start: true }]),
    story_point: free(
      has('story_point', t.points).flatMap((p) =>
        t.points[p].map((o) => ({ story_point: p, outcome: o })),
      ),
    ),
    quest: free(choices('quest', nodes).map((q) => ({ quest: q, outcome: 'completed' }))),
    action: free(
      has('action', t.actions).map((a) => ({ action: a, ...t.actions[a], outcome: 'success' })),
    ),
  };
}

/** Another scene already starts on `on` (scenes.ex:274-292). */
export const refused = (t: Triggers, scene: string, on: On) =>
  Object.entries(t.taken).some(([k, s]) => k !== scene && s === same(on));

/** The starter's `<scene>_quest` (starters/templates.ex) when the scene no longer starts on it and
 * nothing else names it: the author may delete it (never deleted for them). */
export function leftover(t: Triggers, scene: string, on: On) {
  const q = `${scene}_quest`;
  const by = t.named[q];
  return by && on.quest !== q && by.every((n) => n === `scene/${scene}`) ? q : undefined;
}
