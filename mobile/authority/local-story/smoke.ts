// The phone smoke screen's logic (R6 SM, wiring proof for the UI slice): a bundled cartridge played
// through the real local authority, plain so any view can replace the React one. It exposes the
// current GameView, its text, the offered actions as buttons and a log; it adds no mechanics.
import type { GameView, Key } from '../../../kernel/ts/src/contracts.gen.ts';
import {
  gameView,
  INSTALLED,
  KERNEL_ID,
  loadCartridge,
  newWorld,
} from '../../../kernel/ts/src/index.ts';
import type { Cartridge } from '../../../kernel/ts/src/index.ts';
import { openStory, type Reply } from './authority.ts';
import type { Db } from './store.ts';

export type { GameView };
/** A tappable action: its text and the invocation it sends (id and actor are added on press). */
export type Button = { label: string; action_key: string; target_ids: string[]; input: object };
/** A cartridge fixture: its canonical JSON text and content hash. */
export type Bundled = { canonical: string; sha256: string };

const SCOPE = 'story/smoke';
// ponytail: one fixed world context and seed; a real start draws them per lineage (R6P).
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const SEED = [1, 2, 3, 4];
// ponytail: no build commit on the phone yet, so the kernel version is marked dirty and no phone
// trace counts as evidence until it comes from the build (ROADMAP R6 SM); the run id, scope and
// context above are fixed for every save (S3 allocates them per save).
const KERNEL_VERSION = `${KERNEL_ID}@${'0'.repeat(40)}-dirty`;
const ID_PREFIX = '00000000-0000-4000-8000-';
const RUN_ID = '5a5a5a5a-1111-4222-8333-444444444444';

type Say = (key: string) => string;

// The view's available actions as buttons: place actions that need no input, each open exit as a
// move, and each entity's or held item's actions aimed at it.
function buttonsOf(v: GameView, label: Say, text: Say): Button[] {
  const button = (a: { action_key: string; label: string }, name: string, id?: string) => ({
    label: `${label(a.label)}${name}`,
    action_key: a.action_key,
    target_ids: id ? [id] : [],
    input: {},
  });
  const place = v.actions.filter((a) => a.available && !a.input.length && a.target.kind === 'none');
  const moves = v.exits.filter((e) => e.available);
  const held = [...v.entities, ...v.inventory].flatMap((e) =>
    e.actions.filter((a) => a.available).map((a) => button(a, ` ${text(e.name)}`, e.id)),
  );
  return [
    ...place.map((a) => button(a, '')),
    ...moves.map((e) => ({
      label: `Go ${e.direction}`,
      action_key: 'move',
      target_ids: [],
      input: { direction: e.direction },
    })),
    ...held,
  ];
}

// What one press answers: the narration or outcome of an accepted command, else the refusal.
function said(r: Reply, text: Say): string {
  if (r.kind === 'pending') return '(pending: not confirmed saved; press any button to retry it)';
  if (r.kind !== 'saved') return `(${r.kind}${'code' in r ? ` ${r.code}` : ''})`;
  const d = r.decision as { kind: string; outcome?: string; narration?: { key: string }[] };
  if (d.kind === 'rejected')
    return `You can't: ${(r.decision as { error: { code: string } }).error.code}`;
  return d.narration?.map((t) => text(t.key)).join(' ') || d.outcome!;
}

function cartridgeOf(bundled: Bundled): Cartridge {
  const artifact = `{"cartridge":${bundled.canonical},"content_hash":"${bundled.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  if (!loaded.ok) throw new Error(`cartridge did not load: ${JSON.stringify(loaded)}`);
  return loaded.cartridge as Cartridge;
}

// Ids continue from the highest receipt in this allocator's own namespace (replies without a
// receipt leave no trace). ponytail: reads the receipt table directly; openStory exposes none.
function lastId(db: Db): number {
  const last = db.getFirstSync<{ id: string | null }>(
    'SELECT max(invocation_id) AS id FROM receipt WHERE scope = ? AND invocation_id LIKE ?',
    SCOPE,
    `${ID_PREFIX}%`,
  )!.id;
  return last ? parseInt(last.slice(-12), 16) : 0;
}

function invocationOf(b: Button, n: number, actor: string) {
  const invocation_id = `${ID_PREFIX}${n.toString(16).padStart(12, '0')}`;
  return {
    invocation_id,
    action_key: b.action_key,
    actor_id: actor,
    target_ids: b.target_ids,
    input: b.input,
  };
}

/** The save in `db` (a new one if empty) of the bundled cartridge; open `db` once per process. */
export function openSmoke(db: Db, bundled: Bundled) {
  const cartridge = cartridgeOf(bundled);
  const ids = {
    content_hash: bundled.sha256,
    kernel_version: KERNEL_VERSION,
    seed: SEED,
    run_id: RUN_ID,
  };
  const story = openStory(db, newWorld(cartridge, CONTEXT as never, SEED as never), SCOPE, ids);
  // The unconfirmed attempt, resent unchanged (same id, same intent) until it settles (03 §§14-15).
  let retry: { label: string; invocation: object } | undefined;
  let sent = lastId(db);
  const log: string[] = [];
  const text: Say = (key) => cartridge.text[key as Key] ?? key;
  // ponytail: the cartridge has no text for action labels yet, so show the key's last word.
  const label: Say = (key) =>
    cartridge.text[key as Key] ?? key.replace(/^actions?\./, '').replaceAll('_', ' ');
  return {
    screen: () => {
      const view = gameView(story.world());
      return { view, text, buttons: buttonsOf(view, label, text), log, pending: !!retry };
    },
    press(b: Button): void {
      // While unconfirmed any press retries that attempt, whatever button it was.
      retry ??= { label: b.label, invocation: invocationOf(b, ++sent, story.world().character) };
      log.push(`> ${retry.label}`);
      try {
        const reply = story.invoke(retry.invocation);
        log.push(said(reply, text));
        if (reply.kind === 'pending') return;
      } catch (e) {
        // A definite failure: nothing was saved, so the attempt is over; the next press is new.
        log.push(`(not saved: ${(e as Error).message})`);
      }
      retry = undefined;
    },
  };
}
