// Engine action targets/inputs; capability ownership comes from the generated registry.
import type { TargetSpec, ActionInputParameter } from '../contracts.gen.ts';

const entity = (scope: 'room_contents' | 'inventory'): TargetSpec => ({
  kind: 'entity',
  scopes: [scope],
});
// ponytail: every engine verb has priority 0, so they list in key order; give them priorities
// when a host's presentation needs one first. ponytail: this table names other capabilities'
// verbs; each verb's target and input move onto its command's
// registry entry when a second capability contributes a verb outside VERBS (dialogue's talk,
// choose and close_choice come from mechanics/dialogue/shared.ts).
export const VERBS: Readonly<Record<string, [TargetSpec, ActionInputParameter[]]>> = {
  recover_corpse: [entity('room_contents'), []],
  use_transport: [{ kind: 'entity', scopes: ['inspectable_details'] }, ['route', 'quoted_fare']],
  use_service: [{ kind: 'entity', scopes: ['room_occupants'] }, ['service', 'quoted_price']],
  fill: [{ kind: 'entity', scopes: ['inspectable_details'] }, []],
  pour: [entity('inventory'), []],
  eat: [entity('inventory'), []],
  bandage: [entity('inventory'), ['effect_generation']],
  drink: [entity('inventory'), []],
  look: [{ kind: 'none' }, []],
  read: [{ kind: 'entity', scopes: ['inspectable_details'] }, []],
  move: [{ kind: 'none' }, ['direction']],
  scan: [{ kind: 'none' }, []],
  attack: [{ kind: 'entity', scopes: ['room_occupants'] }, []],
  flee: [{ kind: 'none' }, []],
  buy: [entity('room_contents'), ['quoted_price']],
  sell: [entity('inventory'), ['quoted_price']],
  harvest: [{ kind: 'entity', scopes: ['inspectable_details'] }, []],
  take: [entity('room_contents'), []],
  drop: [entity('inventory'), []],
  give: [entity('inventory'), []],
  put: [entity('inventory'), []],
  wait: [{ kind: 'none' }, ['until']],
  open: [{ kind: 'none' }, ['direction']],
  close: [{ kind: 'none' }, ['direction']],
  lock: [{ kind: 'none' }, ['direction']],
  unlock: [{ kind: 'none' }, ['direction']],
  ignite: [entity('inventory'), []],
  douse: [entity('inventory'), []],
  refuel: [entity('inventory'), []],
  wear: [entity('inventory'), []],
  remove: [entity('inventory'), []],
  stand: [{ kind: 'none' }, []],
  sit: [{ kind: 'none' }, []],
  rest: [{ kind: 'none' }, []],
  sleep: [{ kind: 'none' }, []],
};
