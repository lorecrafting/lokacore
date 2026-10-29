// scene@1's engine FactSpecs (mechanics.md), read by cartridge_position.ts expectedFacts.

/** Byte-exact FactSpec; only key and narrate count substitute. Twin of content/scenes.ex. */
export const spec = (key: string, n: number) => ({
  key: `scene_${key}`,
  version: 1,
  value_type: { type: 'int', minimum: -1, maximum: n, default: 0 },
  scopes: ['player'],
  meaning: `Scene ${key}'s line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it.`,
});

export const markerSpec = (key: string, outcomes: string[]) => ({
  key: `story_point_${key}`,
  version: 1,
  value_type: { type: 'enum', values: ['unreached', ...outcomes.sort()], default: 'unreached' },
  scopes: ['player'],
  meaning: `Story point ${key}'s reached outcome (scene@1): only scene@1 writes it.`,
});
