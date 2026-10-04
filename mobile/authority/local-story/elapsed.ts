// A fixed-horizon host driver; lifecycle timers belong to the app/session consumer.
import type { ElapsedStatus } from '../../packages/game-view/session.ts';
import { elapsed, fenced, checkRun } from './delivery.ts';
import {
  accounted,
  ElapsedRecoveryError,
  changedRun,
  sameCheckpoint,
  readElapsed,
  elapsedRows,
  type Checkpoint,
  natural,
} from './elapsed-store.ts';
import { adopt, type Story } from './save.ts';
import { identityOf, persistElapsed, reconcile, transaction } from './store.ts';

export type Clocks = { wall: () => number; monotonic: () => number };
export type Pulse = 'active' | 'resume' | 'pause' | 'drain';
const READY = { kind: 'ready' } as const;

/** Only a closed transaction's exact prior/next durable witnesses confirm administration. */
function metadata(s: Story, row: Checkpoint): ElapsedStatus {
  if (fenced(s)) return { kind: 'pending' };
  if (sameCheckpoint(s.elapsed, row)) return READY;
  const prior = s.elapsed,
    format = s.meta.format;
  const committed = transaction(s.db, () => {
    persistElapsed(s.db, row);
    s.db.runSync('UPDATE save SET format = ? WHERE run_id = ?', 'loka-save-v2', row.run_id);
  });
  if (committed) {
    s.elapsed = row;
    s.meta = { ...s.meta, format: 'loka-save-v2' };
    return READY;
  }
  s.fence = () =>
    reconcile(s.db, () => {
      const meta = identityOf(s.db);
      const changed = changedRun(meta, row.run_id);
      if (changed) throw changed;
      const got = readElapsed(s.db, row.run_id, s.world.state.clock);
      if (meta!.format === 'loka-save-v2' && sameCheckpoint(got, row)) adopt(s);
      else if (
        meta!.format !== format ||
        !sameCheckpoint(got, prior) ||
        (!prior && elapsedRows(s.db).length)
      )
        throw new ElapsedRecoveryError(
          'save_corrupt',
          'unexpected elapsed checkpoint; recovery required',
        );
      return undefined;
    });
  if (fenced(s)) return { kind: 'pending' };
  if (!sameCheckpoint(s.elapsed, row)) throw new Error('COMMIT failed; elapsed was not saved');
  return READY;
}

function boundary(s: Story, target: number): number {
  let until = target;
  for (const job of Object.values(s.world.state.jobs ?? {})) {
    if (job.status !== 'pending') continue;
    if (job.due_time <= s.world.state.clock) throw new Error('already-due job; recovery required');
    until = Math.min(until, job.due_time);
  }
  return until;
}

export class ClockDriver {
  private baseline?: number;
  private run: string;
  private status: ElapsedStatus = READY;
  private candidate?: { row: Checkpoint; mono: number; pause: boolean };
  private s: Story;
  private clocks: Clocks;
  private changed: (status: ElapsedStatus) => void;
  constructor(s: Story, clocks: Clocks, changed: (status: ElapsedStatus) => void) {
    this.run = s.meta.run_id;
    this.s = s;
    this.clocks = clocks;
    this.changed = changed;
  }
  private confirmed() {
    if (this.candidate && sameCheckpoint(this.s.elapsed, this.candidate.row)) {
      this.baseline = this.candidate.pause ? undefined : this.candidate.mono;
      this.candidate = undefined;
    }
  }
  private capture(mode: Exclude<Pulse, 'drain'>) {
    if (this.run !== this.s.meta.run_id) {
      this.run = this.s.meta.run_id;
      this.candidate = undefined;
      this.baseline = undefined;
    }
    if (this.candidate) return;
    const wall = this.clocks.wall(),
      mono = Math.floor(this.clocks.monotonic());
    if (![wall, mono].every(natural)) throw new Error('invalid elapsed clock evidence');
    const old = this.s.elapsed ?? {
      run_id: this.s.meta.run_id,
      wall_ms: wall,
      target: this.s.world.state.clock,
      remainder: 0,
    };
    const d = !this.s.elapsed
      ? 0
      : mode !== 'resume' && this.baseline !== undefined
        ? mono - this.baseline
        : Math.max(0, wall - old.wall_ms);
    const rate = this.s.world.cartridge.manifest.time_policy!.rate;
    this.candidate = { row: accounted(old, d, rate, wall), mono, pause: mode === 'pause' };
  }
  private advance(row: Checkpoint): ElapsedStatus {
    const reply = elapsed(
      this.s,
      {
        expected_run_id: row.run_id,
        from: this.s.world.state.clock,
        until: boundary(this.s, row.target),
      },
      row,
    );
    if (reply.kind === 'pending') return { kind: 'pending' };
    if (reply.kind !== 'saved') throw new Error(`elapsed delivery refused: ${reply.kind}`);
    const decision =
      reply.decision as unknown as import('../../../kernel/ts/src/contracts.gen.ts').DecisionResult;
    if (decision.kind === 'fault') return { kind: 'fault', code: decision.code };
    if (decision.kind === 'rejected') return { kind: 'fault', code: decision.error.code };
    this.confirmed();
    this.changed(this.s.world.state.clock < row.target ? { kind: 'catching_up' } : READY);
    return READY;
  }
  private drain(): ElapsedStatus {
    if (fenced(this.s)) return { kind: 'pending' };
    this.confirmed();
    for (let n = 0; n < 16; n++) {
      const row = this.candidate?.row ?? this.s.elapsed;
      if (!row) return READY;
      if (this.s.world.state.clock >= row.target) {
        const status = this.candidate ? metadata(this.s, row) : READY;
        this.confirmed();
        if (this.candidate) this.changed(status);
        return status;
      }
      const status = this.advance(row);
      if (status.kind !== 'ready') return status;
    }
    return this.s.world.state.clock < this.s.elapsed!.target ? { kind: 'catching_up' } : READY;
  }
  check(expected: string) {
    if (fenced(this.s)) return false;
    if (expected !== this.s.meta.run_id) return false;
    checkRun(this.s);
    return true;
  }
  pulse(mode: Pulse, expected: string): ElapsedStatus {
    const retained = !!this.candidate;
    if (expected !== this.s.meta.run_id) return { kind: 'replaced' };
    if (!this.check(expected)) return { kind: 'pending' };
    this.confirmed();
    if (
      !retained &&
      mode !== 'drain' &&
      (mode !== 'active' || !(this.s.elapsed && this.s.elapsed.target > this.s.world.state.clock))
    )
      this.capture(mode);
    return (this.status = this.drain());
  }
  reserve(expected: string): ElapsedStatus {
    if (expected !== this.s.meta.run_id) return { kind: 'replaced' };
    if (!this.check(expected)) return { kind: 'pending' };
    this.confirmed();
    this.capture('active');
    return (this.status = this.drain());
  }
  state(): ElapsedStatus {
    if (this.s.blocked)
      return this.s.blocked.kind === 'stale_view'
        ? { kind: 'replaced' }
        : { kind: 'error', reason: 'save_corrupt', message: this.s.blocked.message };
    if (this.s.fence) return { kind: 'pending' };
    if (this.status.kind === 'fault') return this.status;
    return this.target() > this.s.world.state.clock ? { kind: 'catching_up' } : READY;
  }
  target() {
    return this.candidate?.row.target ?? this.s.elapsed?.target ?? this.s.world.state.clock;
  }
}
