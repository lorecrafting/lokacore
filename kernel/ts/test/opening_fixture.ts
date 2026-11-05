// scene@1 opening scene (mechanics.md scene@1): the frozen scene_sampler KAT plus a two-line modal
// reverie scene with `on: {start: true}` and the engine FactSpec the compiler adds for it.
const R = 'scene_sampler@0.0.1';
export function opening(c: any) {
  c.scenes[`${R}:scene/opening`] = {
    key: 'opening',
    on: { start: true },
    control: 'modal',
    treatment: 'reverie',
    steps: [
      { type: 'narrate', text: 'scene.bell_rung.bell' },
      { type: 'narrate', text: 'scene.bell_rung.fen' },
      { type: 'await_ack' },
      { type: 'end' },
    ],
  };
  c.facts[`${R}:fact/scene_opening`] = {
    key: 'scene_opening',
    version: 1,
    value_type: { type: 'int', minimum: -1, maximum: 2, default: 0 },
    scopes: ['player'],
    meaning:
      "Scene opening's line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it.",
  };
}
