// The identity/outcome adapter at the authority boundary (R6P P1; 03 §14; 04 §2, §3). The host
// runs 03 §14's order: identify (validate the bounded ActionInvocation, authorize its actor
// against the trusted one, derive the CommandId from the trusted scope and the invocation id,
// digest the intent), then look up a receipt (S1), and only for a NEW attempt resolve it into a
// typed Command for step, which gives accepted, rejected or fault (04 §5.0).
import { hash } from '../foundation/canonical.ts';
import type {
  ActionInvocation,
  CharacterId,
  Command,
  CommandId,
  ErrorCode,
} from '../contracts.gen.ts';
import { resolved } from './actions.ts';
import { rejected, type World } from '../runtime/decision.ts';
import { commandId } from '../foundation/id_source.ts';
import { validate, type ContractError } from '../foundation/validate.ts';

export type Identified = {
  readonly kind: 'identified';
  readonly invocation: ActionInvocation;
  readonly command_id: CommandId;
  readonly intent_digest: string;
};

/**
 * `value` (from foundation/canonical.ts decode) as an invocation of `actor` in the trusted idempotency scope
 * `scope`, both from the host, never the invocation. Malformed is invalid and another actor
 * unauthorized, in that order (validation first, decision register A1); neither gets a receipt.
 */
export function identify(
  scope: string,
  actor: CharacterId,
  value: unknown,
): Identified | { kind: 'invalid'; errors: ContractError[] } | { kind: 'unauthorized' } {
  const errors = validate('ActionInvocation', value);
  if (errors.length) return { kind: 'invalid', errors };
  const invocation = value as ActionInvocation;
  if (invocation.actor_id !== actor) return { kind: 'unauthorized' };
  const command_id = commandId(scope, invocation.invocation_id) as CommandId;
  return { kind: 'identified', invocation, command_id, intent_digest: intentDigest(invocation) };
}

/**
 * The invocation-intent digest (03 §14): SHA-256 of the canonical encoding of the version tag,
 * action key, actor, target ids in their given order and the validated input. The invocation id
 * is the receipt's key, not intent; view_freshness_token is admission metadata (04 §16).
 */
// The receipt's intent_digest_version (03 §14); its bytes and known answers are pinned by
// protocol/fixtures/intent_digest.json. A change of bytes is a new version, never an edit.
export const INTENT_DIGEST_VERSION = 'loka-intent-v1';

const intentDigest = (i: ActionInvocation): string =>
  hash([INTENT_DIGEST_VERSION, i.action_key, i.actor_id, i.target_ids, i.input] as never);

// The Command fields an invocation's ordered target_ids fill, by Command type.
const TARGETS: Readonly<Record<string, readonly string[]>> = {
  use_service: ['provider_id'],
  fill: ['source_id', 'vessel_id'],
  pour: ['source_id', 'receiver_id'],
  drink: ['vessel_id'],
  look: ['target_id'],
  read: ['target_id'],
  harvest: ['target_id'],
  attack: ['target_id'],
  talk: ['target_id'],
  perform: ['target_id'],
  buy: ['provider_id', 'item_id'],
  sell: ['provider_id', 'item_id'],
  take: ['item_id'],
  drop: ['item_id'],
  give: ['item_id', 'recipient_id'],
  put: ['item_id', 'container_id'],
  ignite: ['item_id'],
  douse: ['item_id'],
  refuel: ['item_id', 'supply_id'],
  wear: ['item_id'],
  remove: ['item_id'],
  open: ['target_id'],
  close: ['target_id'],
  lock: ['target_id'],
  unlock: ['target_id'],
};

/**
 * A NEW invocation as the typed Command its action in the actor's current ActionSet resolves to
 * (04 §2), or a terminal rejection: unsupported_capability when the set has no such action, or its
 * Command takes not that many targets or not that input. The rest (target presence, policy) is
 * step's. A quest's offer fills the quest it accepts, as a recipe fills its key, and close_choice
 * the pending continuation it closes (commands/actions.ts resolved).
 */
export function resolve(
  world: World,
  { invocation: i, command_id }: Identified,
): Command | { kind: 'rejected'; error: { code: ErrorCode } } {
  const set = resolved(world, i.actor_id);
  const a = Object.hasOwn(set, i.action_key) ? set[i.action_key] : undefined;
  if (!a) return rejected('unsupported_capability');
  // A target past the Command's slots lands under an unknown key, which validate rejects.
  const slots = TARGETS[a.command] ?? [];
  const targets = Object.fromEntries(i.target_ids.map((t, n) => [slots[n], t]));
  const named = a.dialogue
    ? { dialogue: a.dialogue }
    : a.recipe
      ? { action: a.key }
      : a.quest
        ? { quest: a.quest }
        : a.continuation && { continuation_id: a.continuation };
  const payload = { type: a.command, actor_id: i.actor_id, ...named, ...i.input, ...targets };
  const command = { id: command_id, world_context_id: world.context, payload };
  return validate('Command', command).length
    ? rejected('unsupported_capability')
    : (command as Command);
}
