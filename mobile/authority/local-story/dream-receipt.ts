// Detail routing uses the saved scene binding; accepted-history replay validates its producer.
import type { Command } from '../../../kernel/ts/src/contracts.gen.ts';
import { definition } from '../../../kernel/ts/src/mechanics/scene/dream_shared.ts';
import { detailOf } from '../../../kernel/ts/src/commands/actions.ts';
import type { Story } from './save.ts';

export function dreamDetail(s: Story, command: Command | null) {
  const p = command?.payload;
  const ref =
    p?.type === 'continue'
      ? p.scene
      : p?.type === 'choose'
        ? s.world.state.choices?.[p.continuation_id]?.source
        : undefined;
  const scene = ref && definition(s.world, ref);
  if (!scene) return;
  return `dream:${detailOf(s.world, { kind: 'detail', room: scene.on.rest.room, detail: scene.on.rest.detail })}`;
}
