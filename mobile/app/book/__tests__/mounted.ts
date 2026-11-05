// Real Book state/effect routing over controlled committed Game projections; no native layout claim.
import type { Game, GameView } from '../../../packages/game-view/session.ts';
import { Book, game, nodes, words } from './combat-book.test.ts';
import { control } from './control.test.ts';

export function mounted(initial: GameView, recovered?: ReturnType<Game['lastNarration']>) {
  let current = initial,
    revision = 1, // mutate-skip: test harness, moved unchanged from combat_flow.test.ts
    last = recovered,
    pending = false;
  let respond: () => any = () => ({ kind: 'stale_view' });
  let listener: ((event: any) => void) | undefined;
  const state: any[] = [],
    effects: (() => void)[] = [];
  // Per component, as React's are: a log's lines vary in number and must not shift the hooks after them.
  let slots: Record<string, number> = {};
  const slotOf = () => {
    const scope = (globalThis as any)[Symbol.for('combat-scope')];
    slots[scope] = (slots[scope] ?? 0) + 1; // mutate-skip: test harness, moved unchanged from combat_flow.test.ts
    return `${scope}:${slots[scope]}`;
  };
  const projection = () => ({ view: current, token: `view:${revision}` });
  const g: Game = {
    ...game(initial),
    view: projection,
    lastNarration: () => last,
    text: (key) =>
      ({
        'room.title': 'The cellar',
        'road.title': 'The road',
        'shrine.title': 'The shrine',
        'npc.rat': 'a marsh rat',
        'combat.title_you_attack': 'You attack {target}!',
        'combat.hit': 'You strike the marsh rat.',
        'combat.result': 'The marsh rat falls.',
        'combat.flee': 'You escape to the road.',
        'combat.death': 'You wake at the shrine.',
        'road.crows': 'Crows lift off the road.',
        'rev.1': 'Dark.',
        'rev.2': 'A bell.',
        'rev.3': 'Breath.',
      })[key],
    invoke: () => respond(),
    pending: () => pending,
    pendingInvocation: () => (pending ? 'reservation' : undefined),
    subscribe: (f) => (
      (listener = f),
      f({ kind: 'state', projection: projection(), status: { kind: 'ready' } }),
      () => {
        listener = undefined;
      }
    ),
  };
  (globalThis as any)[Symbol.for('combat-state')] = (initial: any) => {
    const i = slotOf();
    if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
    return [
      state[i],
      (next: any) => {
        state[i] = typeof next === 'function' ? next(state[i]) : next;
      },
    ];
  };
  (globalThis as any)[Symbol.for('combat-effect')] = (f: () => any, deps: any[]) => {
    const i = slotOf(),
      before = state[i];
    if (before && deps.every((d, j) => Object.is(d, before.deps[j]))) return;
    effects.push(() => {
      before?.cleanup?.();
      state[i] = { deps, cleanup: f() };
    });
  };
  const draw = () => {
    slots = {};
    (globalThis as any)[Symbol.for('combat-scope')] = 'Book';
    const root = Book({
      game: g,
      shell: { confirm: (f) => f(), learned: { get: () => true } as never },
      startOver: () => undefined,
    });
    effects.splice(0).forEach((f) => f()); // mutate-skip: test harness, moved unchanged from combat_flow.test.ts
    return nodes(root);
  };
  const texts = () =>
    draw()
      .filter((n) => n.type === 'Text')
      .map(words);
  return {
    texts,
    game: g, // a test may change what the Game answers between draws
    footer: () => draw().some((n) => n.type?.name === 'Footer'),
    said: () => draw().find((n) => n.type?.name === 'Heard').props.said.text as string,
    control: (shown: string | RegExp) => control(draw(), shown),
    node: (match: (n: any) => boolean) => draw().find(match), // any node, a disabled one included
    tap: (shown: string | RegExp) => control(draw(), shown).props.onPress(),
    // `fight`: a line told before `line`, the room reached's arrival (loka-glj8).
    publish: (
      next: GameView,
      line?: string,
      fight?: string,
      status: object = { kind: 'ready' },
    ) => {
      current = next;
      revision++;
      if (line)
        last = {
          command_id: `commit-${revision}`,
          lines: [...(fight ? [{ key: fight }] : []), { key: line }],
          combat_lines: fight ? [0, 1] : [0], // mutate-skip: test harness, moved unchanged from combat_flow.test.ts
          ...(fight && { arrival: 1 }),
          ...(line === 'combat.death' && { died: true }),
        } as never;
      listener?.({ kind: 'state', projection: projection(), status } as never);
    },
    answer: (reply: any, next = current, line?: string, ambient?: string, arrival?: number) => {
      respond = () => {
        current = next;
        revision++;
        pending = reply.kind === 'pending';
        if (line)
          last = {
            command_id: `commit-${revision}`,
            lines: [{ key: line }, ...(ambient ? [{ key: ambient }] : [])],
            combat_lines: [0],
            ...(arrival && { arrival }),
          } as never;
        return reply;
      };
    },
    close: () => state.forEach((s) => s?.cleanup?.()),
  };
}
