// Private E1 policy: docs/system/e1-certification.md.
import { createHash } from 'node:crypto';
import { encode } from '../src/foundation/canonical.ts';
import { CAPABILITY_OWNERS } from '../src/contracts.gen.ts';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';
import { nodes, parts } from '../src/content/cartridge_refs.ts';
import { uses as dialogueUses } from '../src/content/cartridge_dialogues.ts';
import { uses as reactionUses } from '../src/content/cartridge_reactions.ts';
import { VERBS } from '../src/commands/verbs.ts';

export const CANDIDATE = {
  id: 'ashmere_missing_child',
  version: '0.0.42',
  content_hash: '5d8b0e3a16b209733707a8450cee5a4330965092498cf1d31ab8fdae9a50fc8b',
};
export const sha256 = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

// Conservative lock obligations include engine dependencies with no authored definition.
// Detailed uses below keep a new command or consequence visible within its family.
const POLICY: Readonly<Record<string, readonly string[]>> = {
  movement: ['TOPOLOGY'],
  barrier: ['TOPOLOGY'],
  containment: ['TRANSACTION'],
  equipment: ['TRANSACTION'],
  inspectable_detail: ['RULES'],
  description_variant: ['RULES'],
  policy: ['RULES'],
  fact: ['RULES'],
  resource: ['TRANSACTION'],
  attributes: ['RULES'],
  position: ['RULES'],
  skills: ['RULES'],
  check: ['RULES'],
  combat: ['RULES', 'WORLD'],
  death: ['RULES', 'AUTHORITY'],
  quest: ['QUEST'],
  dialogue: ['QUEST'],
  scene: ['SCENE'],
  action_recipe: ['RULES'],
  reaction: ['WORLD'],
  behavior: ['WORLD'],
  schedule: ['WORLD'],
  population: ['WORLD'],
  commerce: ['TRANSACTION'],
  service: ['TRANSACTION', 'TOPOLOGY'],
  calendar: ['WORLD'],
  light: ['WORLD'],
  liquid: ['TRANSACTION'],
  readable: ['RULES'],
  topics: ['QUEST'],
  escort: ['QUEST', 'WORLD'],
  patrol: ['QUEST', 'WORLD'],
  transport: ['TRANSACTION', 'TOPOLOGY'],
  food: ['TRANSACTION'],
  bleed: ['RULES', 'WORLD'],
  water: ['RULES', 'WORLD'],
  expedition: ['QUEST', 'WORLD'],
  knowledge: ['RULES'],
};
const WORLD_OWNERS: Readonly<Record<string, string>> = {
  bands: 'resource',
  bell_cue: 'fact',
  carry: 'containment',
  combat: 'combat',
  death: 'death',
  death_credit: 'combat',
  movement: 'movement',
  water: 'water',
};
export const POLICY_HASH = sha256(encode({ capabilities: POLICY, world: WORLD_OWNERS } as never));
type Use = { feature: string; path: string; gates: readonly string[] };

/** The real loader validates dependencies first; the literal answer then selects this release. */
export function admitCandidate(bytes: Uint8Array) {
  const admitted = loadCartridge(bytes, INSTALLED);
  if (!admitted.ok) throw new Error(encode(admitted.diagnostic as never));
  const cartridge = admitted.cartridge as Cartridge;
  const policy = applicability(cartridge);
  const { id, version } = cartridge.manifest;
  if (
    id !== CANDIDATE.id ||
    version !== CANDIDATE.version ||
    admitted.hash !== CANDIDATE.content_hash
  )
    throw new Error(
      'wrong E1 candidate: expected ashmere_missing_child@0.0.42 and its frozen hash',
    );
  const artifact = encode({ cartridge, content_hash: admitted.hash } as never);
  return { cartridge, hash: admitted.hash, artifact, policy };
}

/** No fallback row: an admitted engine feature with no proof disposition blocks. */
export function applicability(c: Cartridge) {
  const uses: Use[] = [];
  const add = (owner: string, feature: string, path: string) => {
    if (c.lock.capabilities[owner] !== 1 || !Object.hasOwn(POLICY, owner))
      throw new Error(`unknown applicability: ${feature} at ${path}`);
    uses.push({ feature, path, gates: POLICY[owner]! });
  };
  const owned = (kind: keyof typeof CAPABILITY_OWNERS, name: string, path: string) => {
    const table: Readonly<Record<string, string>> = CAPABILITY_OWNERS[kind];
    if (!Object.hasOwn(table, name)) throw new Error(`unknown applicability: ${kind}.${name}`);
    add(table[name]!.split('@')[0]!, `${kind}.${name}`, path);
  };
  for (const [owner, version] of Object.entries(c.lock.capabilities))
    add(owner, `${owner}@${version}`, `.lock.capabilities.${owner}`);
  for (const [kind, , at] of parts(c)) owned('definition', kind, at);
  for (const [node, at] of nodes(c)) owned('policy', node.op, at);
  for (const [kind, name, at] of [...dialogueUses(c), ...reactionUses(c)]) owned(kind, name, at);
  for (const [name, action] of Object.entries(c.actions)) owned('command', action.command, name);
  for (const name of Object.keys(VERBS))
    if (
      Object.hasOwn(
        c.lock.capabilities,
        CAPABILITY_OWNERS.command[name as keyof typeof VERBS]?.split('@')[0] ?? '',
      ) &&
      (name !== 'wait' || !c.manifest.time_policy)
    )
      owned('command', name, `engine.ActionSet.${name}`);
  for (const name of [
    'talk',
    'choose',
    'close_choice',
    'continue',
    'accept_quest',
    'perform',
    'elapsed',
    'run_job',
  ])
    if (
      Object.hasOwn(
        c.lock.capabilities,
        CAPABILITY_OWNERS.command[name as keyof typeof CAPABILITY_OWNERS.command]!.split('@')[0]!,
      )
    )
      owned('command', name, `engine.${name}`);
  inventory(c, uses);
  return {
    uses,
    gates: [
      ...new Set(['STATIC', 'DETERMINISM', 'AUTHORITY', ...uses.flatMap((u) => u.gates)]),
    ].sort(),
  };
}

// Every authored branch/beat/consequence is retained: these paths cannot disappear
// behind a capability label. These rows stay pending until a controlled receipt names them.
function inventory(c: Cartridge, uses: Use[]) {
  const walk = (value: unknown, path: string, owner: string, depth = 0) => {
    if (value !== null && typeof value === 'object') {
      const row = value as Record<string, unknown>;
      if (
        ['op', 'type', 'evidence', 'control'].some((key) => Object.hasOwn(row, key)) ||
        /\/(?:choices|outcomes|steps|apply|sequence)\/[^/]+$/.test(path) ||
        depth === 1
      )
        uses.push({ feature: `authored.${owner}`, path, gates: POLICY[owner]! });
      for (const [name, child] of Object.entries(value))
        walk(child, `${path}/${name}`, owner, depth + 1);
    }
  };
  for (const [section, owner] of Object.entries({
    quests: 'quest',
    dialogues: 'dialogue',
    scenes: 'scene',
    recipes: 'action_recipe',
    reactions: 'reaction',
    transports: 'transport',
    services: 'service',
    populations: 'population',
    items: 'containment',
    npcs: 'containment',
    resources: 'resource',
    ancestries: 'attributes',
    bleeds: 'bleed',
  }))
    walk(c[section as keyof Cartridge], `/${section}`, owner);
  for (const [key, value] of Object.entries(c.world ?? {})) {
    if (!Object.hasOwn(WORLD_OWNERS, key)) throw new Error(`unknown applicability: world.${key}`);
    const owner = WORLD_OWNERS[key]!;
    if (c.lock.capabilities[owner] !== 1)
      throw new Error(`unknown applicability: world.${key} requires ${owner}@1`);
    walk({ [key]: value }, '/world', owner);
  }
}
