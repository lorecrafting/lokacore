// A modal scene's trigger offers (kernel/ts/play/scene_trigger.ts): only what the compile takes
// (lib/loka/content/scenes.ex), and the starter's quest a switch leaves.
import assert from 'node:assert/strict';
import test from 'node:test';
import { leftover, offers, outcomeRefused, outcomesOf, triggers } from '../play/scene_trigger.ts';

const ref = (kind: string, key: string) => ({ kind, key });
// a compiled cartridge's shape (loadCartridge): definitions by ref, `on` naming refs
const c = {
  // `far` is outside the scene's area (not in nodes, area_rules.ex)
  story_points: {
    p: { key: 'fate', outcomes: { burn: {}, keep: {} } },
    g: { key: 'other', outcomes: { ring: {} } },
    f: { key: 'far', outcomes: { x: {} } },
  },
  quests: { q: { key: 'ash_quest' }, r: { key: 'bell_quest' } },
  rooms: { r: { key: 'dock', details: { post: {} } } },
  scripted_actions: {
    a: { key: 'coil', target: { kind: 'detail', room: ref('room', 'dock'), detail: 'post' } },
    b: { key: 'stray', target: { kind: 'detail', room: ref('room', 'dock'), detail: 'gone' } },
  },
  scenes: {
    s: { key: 'ash', on: { story_point: ref('story_point', 'fate'), outcome: 'burn' } },
    o: { key: 'dawn', on: { start: true } },
    d: { key: 'dream', on: { rest: { room: ref('room', 'dock') } } },
    b: { key: 'bell', on: { quest: ref('quest', 'bell_quest'), outcome: 'completed' } },
  },
};
const nodes = [
  ...['fate', 'other'].map((k) => ({ ref: `x@0:story_point/${k}`, kind: 'story_point' })),
  ...['ash_quest', 'bell_quest'].map((k) => ({ ref: `x@0:quest/${k}`, kind: 'quest' })),
  ...['coil', 'stray'].map((k) => ({ ref: `x@0:action/${k}`, kind: 'action' })),
];
const edges = (...from: string[]) =>
  from.map((f) => ({ from: `x@0:${f}`, to: 'x@0:quest/ash_quest' }));
const t = triggers(c, edges('scene/ash'));

// Break: the scene's other fields or a leftover outcome ride along into Opening (valid_source?,
// scenes.ex:149-156), or a second opening is offered though every start collides (scenes.ex:274-292).
test('Opening is exactly {start: true}, and only for the one opening scene', () => {
  assert.deepEqual(offers(t, 'dawn', nodes).start, [{ start: true }]);
  assert.deepEqual(offers(t, 'ash', nodes).start, []);
});

// Break: a story point's pair another scene starts on is offered (DUPLICATE_DEFINITION,
// scenes.ex:274-292), an outcome the point lacks (scenes.ex:241-257), another area's point, or the
// scene's own pair refused.
test('a story point offers its outcomes no other scene starts on', () => {
  assert.deepEqual(offers(t, 'dawn', nodes).story_point, [
    { story_point: 'fate', outcome: 'keep' },
    { story_point: 'other', outcome: 'ring' },
  ]);
  const ash = offers(t, 'ash', nodes).story_point;
  assert.deepEqual(ash, [
    { story_point: 'fate', outcome: 'burn' },
    { story_point: 'fate', outcome: 'keep' },
    { story_point: 'other', outcome: 'ring' },
  ]);
  // Break: the outcome picker lists another point's outcome, and fate + ring is refused (scenes.ex:241-257).
  assert.deepEqual(outcomesOf(ash, { story_point: 'fate', outcome: 'burn' }), ['burn', 'keep']);
});

// Break: every start is one on (scenes.ex:278): a start that carries an outcome still holds the opening.
test('a start with an outcome still takes the one opening', () => {
  const s = { ...c, scenes: { o: { key: 'dawn', on: { start: true, outcome: 'x' } } } };
  assert.deepEqual(offers(triggers(s, []), 'dusk', nodes).start, []);
});

// Break: a typed quest outcome another scene starts on with that quest (DUPLICATE_DEFINITION,
// scenes.ex:274-292), or one that is no Key, is written; or the scene's own pair or a free key refused.
test('a typed quest outcome is refused when taken by another scene or not a Key', () => {
  const on = { quest: 'bell_quest', outcome: 'rung' };
  assert.equal(outcomeRefused(t, 'ash', on, 'completed'), true);
  assert.equal(outcomeRefused(t, 'ash', on, 'Bad Key'), true);
  assert.equal(outcomeRefused(t, 'ash', on, 'tolled'), false);
  assert.equal(outcomeRefused(t, 'bell', on, 'completed'), false);
});

// Break: an action whose target's room lacks the detail is offered (OUTCOME_MISMATCH, scenes.ex:174-181),
// or the on lacks its room, detail or `success` (valid_source?, scenes.ex:149-156); a taken quest pair offered.
test('an action names its target room and detail and succeeds; a taken quest pair is not offered', () => {
  const all = offers(t, 'dawn', nodes);
  assert.deepEqual(all.action, [
    { action: 'coil', room: 'dock', detail: 'post', outcome: 'success' },
  ]);
  assert.deepEqual(all.quest, [{ quest: 'ash_quest', outcome: 'completed' }]);
});

// Break: the note shows while the scene still starts on its quest, while another node names it, or
// never once the quest is unnamed.
test('the starter quest is left over only when nothing else names it', () => {
  assert.equal(leftover(t, 'ash', { start: true }), 'ash_quest');
  assert.equal(leftover(triggers(c, []), 'ash', { start: true }), 'ash_quest');
  assert.equal(leftover(t, 'ash', { quest: 'ash_quest', outcome: 'completed' }), undefined);
  assert.equal(
    leftover(triggers(c, edges('scene/ash', 'dialogue/bram')), 'ash', { start: true }),
    undefined,
  );
});
