import { dream } from './cartridge_dreams.ts';
// scene@1's ordered subset, trigger/text references and engine FactSpec (mechanics.md).
import type { Diagnostic } from '../contracts.gen.ts';
import { checkers, diag, step, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';

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

export function scenes(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { named, typedValue, text } = checkers(c, out);
  const triggers: Record<string, string[]> = {};
  for (const [k, s] of Object.entries((c.scenes ?? {}) as Obj)) {
    const at = `.cartridge.scenes${step(k)}`;
    if (s.control === 'presentation_only') {
      out.push(...dream(c, s, at, checkers(c, out)));
      const trigger = `rest/${refString(s.on.rest.room)}/${s.on.rest.detail}`;
      (triggers[trigger] ??= []).push(`${at}.on`);
      continue;
    }
    source(c, s, at, named, out);
    lines(s, at, text, out);
    ending(c, s, at, named, typedValue, out);
    const kind = s.on.action ? 'action' : s.on.quest ? 'quest' : 'story_point';
    const trigger = `${kind}/${s.on[kind] ? refString(s.on[kind]) : ''}/${s.on.outcome ?? ''}`;
    (triggers[trigger] ??= []).push(`${at}.on`);
  }
  for (const paths of Object.values(triggers))
    if (paths.length > 1) out.push(...paths.map((p) => diag('DUPLICATE_DEFINITION', p)));
  return out;
}

type Checks = ReturnType<typeof checkers>;

function source(c: Obj, s: Obj, at: string, named: Checks['named'], out: Diagnostic[]) {
  const on = s.on;
  const quest = !!on.quest,
    action = !!on.action;
  if (
    [quest, action, !!on.story_point].filter(Boolean).length !== 1 ||
    (action ? !on.room || !on.detail || on.outcome !== 'success' : !on.outcome)
  )
    out.push(diag('SCHEMA_VIOLATION', `${at}.on`));
  if (action) {
    named(on.action, 'recipe', `${at}.on.action`);
    named(on.room, 'room', `${at}.on.room`);
    const recipe = c.recipes?.[refString(on.action)];
    const room = c.rooms?.[refString(on.room)];
    if (
      recipe &&
      room &&
      (refString(recipe.target.room) !== refString(on.room) ||
        recipe.target.detail !== on.detail ||
        !Object.hasOwn(room.details ?? {}, on.detail))
    )
      out.push(diag('OUTCOME_MISMATCH', `${at}.on`));
  } else if (quest || on.story_point) {
    const kind = quest ? 'quest' : 'story_point';
    named(on[kind], kind, `${at}.on.${kind}`);
  }
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  const required = action || s.on_end ? 15 : quest ? 12 : 0;
  if (required && (major < 1 || (major === 1 && minor < required)))
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  const point =
    !quest && !action && on.story_point ? c.story_points?.[refString(on.story_point)] : undefined;
  if (point && !Object.hasOwn(point.outcomes, on.outcome))
    out.push(diag('UNRESOLVED_REFERENCE', `${at}.on.outcome`, { target: on.outcome }));
}

function lines(s: Obj, at: string, text: Checks['text'], out: Diagnostic[]) {
  s.steps.forEach((line: Obj, i: number) => text(line, ['text'], `${at}.steps[${i}]`));
  const n = s.steps.findIndex((line: Obj) => line.type !== 'narrate');
  const count = n === -1 ? s.steps.length : n;
  const want = [...Array(Math.max(1, count)).fill('narrate'), 'await_ack', 'end'];
  const i = want.findIndex((t, i) => s.steps[i]?.type !== t);
  if (i !== -1 || s.steps.length !== want.length)
    out.push(
      diag('SCHEMA_VIOLATION', `${at}.steps[${i === -1 ? want.length : i}].type`, {
        error: 'not_in_enum',
      }),
    );
}

function ending(
  c: Obj,
  s: Obj,
  at: string,
  named: Checks['named'],
  typedValue: Checks['typedValue'],
  out: Diagnostic[],
) {
  if (!s.on_end) return;
  const end = s.on_end;
  named(end.story_point, 'story_point', `${at}.on_end.story_point`);
  const target = c.story_points?.[refString(end.story_point)]?.outcomes[end.outcome];
  if (!target?.scene || target.scene.key !== s.key)
    out.push(diag('OUTCOME_MISMATCH', `${at}.on_end.outcome`));
  const names = end.assign.map((a: Obj) => refString(a.fact));
  if (new Set(names).size !== names.length)
    out.push(diag('DUPLICATE_DEFINITION', `${at}.on_end.assign`));
  end.assign.forEach((a: Obj, i: number) => {
    const path = `${at}.on_end.assign[${i}]`;
    named(a.fact, 'fact', `${path}.fact`);
    typedValue(a.fact, a.value, `${path}.value`);
    const f = c.facts[refString(a.fact)];
    if (
      f &&
      (f.scopes.length !== 1 ||
        f.scopes[0] !== 'player' ||
        f.key.startsWith('scene_') ||
        f.key.startsWith('story_point_'))
    )
      out.push(diag('RESERVED_FACT', `${path}.fact`));
  });
}
