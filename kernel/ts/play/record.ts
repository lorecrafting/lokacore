// Transcript recorder for showcase walks: the transcripts.test.ts replay path, fed chosen commands.
// A walk script does `const r = new Rec(ctx); r.go('west'); ...; r.save(out)`, run as `node <script> <out>`.
import { readFileSync, writeFileSync } from 'node:fs';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { gameView, INSTALLED, KERNEL_ID, loadCartridge, type Cartridge } from '../src/index.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';
import { ROOT, line } from './obs.ts';
import { decideReplay, header, start } from './run.ts';

const kat = JSON.parse(readFileSync(ROOT + 'protocol/fixtures/toolbox_showcase_hash.json', 'utf8'));
const loaded = loadCartridge(
  Buffer.from(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const { hash } = loaded;
const cartridge = loaded.cartridge as Cartridge;
const RUN = 'aaaaaaaa-0000-4000-8000-000000000002';
export const HOUR = 3600;
export const DAY = 24 * HOUR;
type Expect = 'accepted' | 'rejected' | 'any';

export class Rec {
  r: any;
  out: string;
  n = 2;
  log: string[] = [];
  constructor(ctx = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f') {
    this.r = start(cartridge, hash, RUN, ctx, [1, 2, 3, 4], `${KERNEL_ID}@${'0'.repeat(40)}`);
    this.out = header(this.r);
  }
  get w(): any {
    return this.r.world;
  }
  ref = (kind: string, key: string) => `toolbox_showcase@0.0.1:${kind}/${key}`;
  id = (kind: string, key: string): string => this.w.entityIds[this.ref(kind, key)];
  npc = (k: string) => this.id('npc', k);
  item = (k: string) => this.id('item', k);
  detail = (key: string) => {
    const here = this.w.state.containers[this.w.body];
    const found = Object.keys(this.w.details).find(
      (k) => this.w.details[k].key === key && this.w.details[k].room === here,
    );
    if (!found) throw new Error(`no detail ${key} here`);
    return found;
  };
  read = (key: string) => this.act({ type: 'read', target_id: this.detail(key) });
  run(command: any, expect: Expect = 'accepted') {
    const { trace, decision } = decideReplay(this.r, command) as any;
    this.out += line(trace);
    const note = `${this.r.ordinal} ${command.payload.type} ${decision.kind} ${
      decision.kind === 'accepted'
        ? (decision.narration ?? []).map((l: any) => l.key).join(',')
        : JSON.stringify(decision.error?.code ?? decision)
    }`;
    this.log.push(note);
    if (expect !== 'any' && decision.kind !== expect) {
      console.log(this.log.slice(-25).join('\n'));
      throw new Error(`expected ${expect}: ${note}`);
    }
    return decision;
  }
  act(p: object, expect: Expect = 'accepted') {
    this.n += 1;
    return this.run(
      {
        id: `aaaaaaaa-0000-4000-8000-${String(this.n).padStart(12, '0')}`,
        world_context_id: this.w.context,
        payload: { actor_id: this.w.character, ...p },
      },
      expect,
    );
  }
  go = (direction: string) => this.act({ type: 'move', direction });
  take = (item: string) => this.act({ type: 'take', item_id: this.item(item) });
  perform = (action: string) => this.act({ type: 'perform', action });
  talk = (who: string) => this.act({ type: 'talk', target_id: this.npc(who) });
  choose = (choice_id: string) => {
    const [continuation_id] = pending(this.w, this.w.character) as any;
    return this.act({ type: 'choose', choice_id, continuation_id });
  };
  say = (who: string, choice: string) => {
    if (!pending(this.w, this.w.character)) this.talk(who);
    return this.choose(choice);
  };
  leave = () =>
    this.act({
      type: 'close_choice',
      continuation_id: (pending(this.w, this.w.character) as any)[0],
    });
  view = () => gameView(this.w);
  wait(target: number) {
    while (this.w.state.clock < target) {
      const from = this.w.state.clock;
      const until = Object.values(this.w.state.jobs ?? {})
        .filter(
          (j: any) =>
            j.status === 'pending' && j.job.kind !== 'calendar' && j.due_time > this.w.state.clock,
        )
        .reduce((t: number, j: any) => Math.min(t, j.due_time), target);
      this.run({
        id: elapsedCommandId(RUN, this.w.context, this.w.state.clock, until),
        world_context_id: this.w.context,
        payload: {
          type: 'elapsed',
          actor_id: this.w.character,
          run_id: RUN,
          from: this.w.state.clock,
          until,
        },
      });
      if (this.w.state.clock === from) throw new Error(`elapsed stalled at ${this.w.state.clock}`);
    }
  }
  save(path: string) {
    writeFileSync(path, this.out);
    console.log(this.log.join('\n'));
    console.log(`${path}: ${this.r.ordinal} commands`);
  }
}
