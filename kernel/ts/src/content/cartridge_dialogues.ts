// Dialogue owner uses for cartridge.ts lockStage until B2 removes it; dialogue checks are the
// compiler's (lib/loka/content/dialogues.ex).
import { step, type Obj } from './cartridge_refs.ts';

const each = (c: Obj): [Obj, string][] =>
  Object.entries((c.dialogues ?? {}) as Obj).map(([ref, d]) => [
    d,
    `.cartridge.dialogues${step(ref)}`,
  ]);

/** Each owner reference of each dialogue and story point: [registry field, name, path]. */
export const uses = (c: Obj) =>
  [
    ...each(c).flatMap(([d, at]) => [
      ['definition', 'dialogue', at],
      ...(d.keyword ? [['event', 'spoken', `${at}.keyword`]] : []), // speech@1 (row G9)
      ...Object.entries(d.choices as Obj).flatMap(([id, o]) => [
        ...(o.escort ? [['definition', 'escort', `${at}.choices${step(id)}.escort`]] : []),
        ...(o.receive ? [['event', 'item_acquired', `${at}.choices${step(id)}.receive`]] : []),
        ...(o.check ? [['event', 'check_passed', `${at}.choices${step(id)}.check`]] : []),
        ...(o.sequence ?? []).map((_: Obj, i: number) => [
          'event',
          'fact_changed',
          `${at}.choices${step(id)}.sequence[${i}].op`,
        ]),
      ]),
    ]),
    ...Object.keys((c.story_points ?? {}) as Obj).map((ref) => [
      'event',
      'story_point_reached',
      `.cartridge.story_points${step(ref)}`,
    ]),
  ] as ['definition' | 'event', string, string][];
