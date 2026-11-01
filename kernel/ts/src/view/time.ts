// GameView's time fields (view.ts gameView).
import { awayCapMs, status as calendarStatus } from '../mechanics/calendar.ts';
import type { World } from '../runtime/decision.ts';

// The clock, its derived calendar status and the W27 away recap threshold in logical seconds.
export function timeView(world: World) {
  const calendar_status = calendarStatus(world.cartridge, world.context, world.state.clock);
  const policy = world.cartridge.manifest.time_policy;
  const minutes = policy?.recap_after_minutes;
  return {
    time: world.state.clock,
    ...(calendar_status && { calendar_status }),
    // Capped: a settlement never spans more than the away cap, so a higher threshold could never fire.
    ...(minutes && {
      recap_after: Math.min(
        minutes * 60 * policy!.rate,
        Math.floor((awayCapMs(world.cartridge) * policy!.rate) / 1000),
      ),
    }),
  };
}
